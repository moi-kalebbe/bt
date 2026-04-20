import {
  setContentScheduled,
  findContentById,
} from '@/infra/supabase/repositories/content.repository';
import { createPublishJob } from '@/infra/supabase/repositories/publish-jobs.repository';
import { getPerformanceByHour } from '@/infra/supabase/repositories/instagram-metrics.repository';
import { supabase } from '@/infra/supabase/client';
import { scoreContent, hybridScore } from '@/lib/scoring';
import type { ContentItem, PublishTarget, Slot } from '@/types/domain';

// ─── Slot windows: candidate times per slot for A/B testing ──────────────────
// Epsilon-greedy picks the best performer 70% of the time, explores 30%.
// Over time, posting concentrates in the hours with highest real engagement.
const SLOT_WINDOWS: Record<Slot, Array<{ hour: number; minute: number }>> = {
  morning: [{ hour: 7, minute: 0 }, { hour: 8, minute: 0 }, { hour: 9, minute: 0 }],
  midday:  [{ hour: 11, minute: 0 }, { hour: 12, minute: 0 }, { hour: 13, minute: 0 }],
  evening: [{ hour: 17, minute: 0 }, { hour: 18, minute: 0 }, { hour: 19, minute: 0 }],
  night:   [{ hour: 20, minute: 0 }, { hour: 21, minute: 0 }, { hour: 22, minute: 0 }],
};

const ALL_SLOTS: Slot[] = ['morning', 'midday', 'evening', 'night'];

const EPSILON = 0.3; // 30% exploration, 70% exploit best-performing hour

export interface ScheduleResult {
  scheduled: Array<{ slot: Slot; contentId: string; score: number; day: string }>;
  skipped: number;
  days: number;
}

// ─── Main entry point ─────────────────────────────────────────────────────────
// Schedules content for up to `days` future days, skipping days that already
// have publish_jobs. Safe to call multiple times (idempotent for scheduled days).
export async function selectAndScheduleVideos(
  niche = 'beach-tennis',
  days = 7
): Promise<ScheduleResult> {
  const result: ScheduleResult = { scheduled: [], skipped: 0, days: 0 };

  // Performance data for epsilon-greedy time selection
  const hourlyPerf = await getPerformanceByHour(niche).catch(() => new Map<number, number>());

  // Days that already have ≥1 scheduled publish_job — skip these
  const scheduledDays = await getScheduledDays(niche, days);

  // Authors used in the last 7 days — deprioritize repeats
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentItems } = await supabase
    .from('content_items')
    .select('author_username')
    .eq('niche', niche as string)
    .not('selected_for_slot', 'is', null)
    .gte('updated_at', recentCutoff);

  const recentAuthors = new Set<string>(
    (recentItems ?? [])
      .map((r: { author_username: string | null }) => r.author_username)
      .filter(Boolean) as string[]
  );

  // Fetch + score candidates (top 200 ready videos with processed video)
  const { data: readyVideos } = await supabase
    .from('content_items')
    .select('*')
    .eq('status', 'ready')
    .eq('niche', niche as string)
    .is('selected_for_slot', null)
    .not('processed_video_r2_key', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  const candidates = (readyVideos ?? [])
    .map((video) => {
      const sourceScore = scoreContent({
        source: video.source as 'tiktok' | 'youtube',
        sourceVideoId: video.source_video_id,
        sourceUrl: video.source_url,
        authorUsername: video.author_username,
        authorDisplayName: video.author_display_name,
        title: video.title,
        description: video.description,
        hashtags: video.hashtags ?? [],
        publishedAtSource: video.published_at_source,
        thumbnailUrl: video.thumbnail_original_url,
        durationSeconds: video.duration_seconds,
        rawPayload: video.raw_payload,
      });
      const igPerfScore = video.instagram_performance_score != null
        ? Number(video.instagram_performance_score)
        : null;
      return { video: video as ContentItem, score: hybridScore(sourceScore, igPerfScore) };
    })
    .sort((a, b) => b.score - a.score);

  const usedContentIds = new Set<string>();

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const dateKey = getUtcDateKey(dayOffset);

    if (scheduledDays.has(dateKey)) continue; // Already has content, skip

    // Pick 4 videos for this day with per-day author uniqueness
    const dayAuthors = new Set<string>();
    const dayVideos: typeof candidates = [];

    for (const candidate of candidates) {
      if (dayVideos.length >= ALL_SLOTS.length) break;
      if (usedContentIds.has(candidate.video.id)) continue;
      const author = candidate.video.author_username as string | null;
      if (author && dayAuthors.has(author)) continue;
      if (author) dayAuthors.add(author);
      // Soft deprioritize recent authors but don't block when pool is small
      dayVideos.push(candidate);
    }

    // If strict diversity yields too few, fill with best remaining
    if (dayVideos.length < ALL_SLOTS.length) {
      const picked = new Set(dayVideos.map((c) => c.video.id));
      for (const candidate of candidates) {
        if (dayVideos.length >= ALL_SLOTS.length) break;
        if (!picked.has(candidate.video.id) && !usedContentIds.has(candidate.video.id)) {
          dayVideos.push(candidate);
          picked.add(candidate.video.id);
        }
      }
    }

    if (dayVideos.length === 0) {
      result.skipped += ALL_SLOTS.length;
      continue;
    }

    for (let i = 0; i < ALL_SLOTS.length && i < dayVideos.length; i++) {
      const slot = ALL_SLOTS[i];
      const { video, score } = dayVideos[i];
      const time = pickSlotTime(slot, hourlyPerf);
      const scheduledFor = getSlotTimeForDay(dayOffset, time.hour, time.minute);

      await setContentScheduled(video.id, slot);
      await createPublishJobsForVideo(video, slot, scheduledFor);

      usedContentIds.add(video.id);
      recentAuthors.add(video.author_username as string ?? '');
      result.scheduled.push({ slot, contentId: video.id, score, day: dateKey });
    }

    result.skipped += Math.max(0, ALL_SLOTS.length - dayVideos.length);
    result.days++;
  }

  return result;
}

// ─── Manual override (single slot, used by admin UI) ─────────────────────────
export async function manualSchedule(
  contentId: string,
  slot: Slot
): Promise<{ success: boolean; error?: string }> {
  const content = await findContentById(contentId);
  if (!content) return { success: false, error: 'Content not found' };
  if (content.status !== 'ready') {
    return { success: false, error: `Content status must be 'ready', got '${content.status}'` };
  }

  const hourlyPerf = await getPerformanceByHour('beach-tennis').catch(() => new Map<number, number>());
  const time = pickSlotTime(slot, hourlyPerf);
  const scheduledFor = getSlotTimeForDay(0, time.hour, time.minute);

  await setContentScheduled(contentId, slot);
  await createPublishJobsForVideo(content, slot, scheduledFor);

  return { success: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Returns set of UTC date strings (YYYY-MM-DD) that already have scheduled jobs
async function getScheduledDays(niche: string, days: number): Promise<Set<string>> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const { data } = await supabase
    .from('publish_jobs')
    .select('scheduled_for, content_items!inner(niche)')
    .eq('status', 'scheduled')
    .eq('content_items.niche', niche)
    .gte('scheduled_for', now.toISOString())
    .lt('scheduled_for', end.toISOString());

  const result = new Set<string>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const sf = row['scheduled_for'] as string | null;
    if (sf) result.add(sf.substring(0, 10));
  }
  return result;
}

async function getActiveTargets(): Promise<PublishTarget[]> {
  const { data, error } = await supabase
    .from('publish_targets')
    .select()
    .eq('active', true);
  if (error) throw error;
  return (data ?? []) as PublishTarget[];
}

async function createPublishJobsForVideo(
  video: ContentItem,
  slot: Slot,
  scheduledFor: string
): Promise<void> {
  const targets = await getActiveTargets();
  if (targets.length === 0) return;

  await Promise.all(
    targets.map((target) =>
      createPublishJob({
        contentItemId: video.id,
        targetId: target.id,
        slot,
        scheduledFor,
      })
    )
  );
}

// Epsilon-greedy: 70% pick best candidate hour, 30% explore randomly
function pickSlotTime(slot: Slot, hourlyPerf: Map<number, number>): { hour: number; minute: number } {
  const candidates = SLOT_WINDOWS[slot];

  if (hourlyPerf.size === 0 || Math.random() < EPSILON) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  return candidates.reduce((best, c) => {
    const bestPerf = hourlyPerf.get(best.hour) ?? 0;
    const cPerf = hourlyPerf.get(c.hour) ?? 0;
    return cPerf > bestPerf ? c : best;
  });
}

// UTC date key for a given day offset from now
function getUtcDateKey(dayOffset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().substring(0, 10);
}

// Slot datetime for a specific day offset (uses server local time, same as original)
function getSlotTimeForDay(dayOffset: number, hour: number, minute: number): string {
  const scheduled = new Date();
  scheduled.setDate(scheduled.getDate() + dayOffset);
  scheduled.setHours(hour, minute, 0, 0);
  // For day 0, if time already passed today, push to tomorrow
  if (dayOffset === 0 && scheduled <= new Date()) {
    scheduled.setDate(scheduled.getDate() + 1);
  }
  return scheduled.toISOString();
}
