import {
  findContents,
  setContentScheduled,
  findContentById,
} from '@/infra/supabase/repositories/content.repository';
import { createPublishJob } from '@/infra/supabase/repositories/publish-jobs.repository';
import { supabase } from '@/infra/supabase/client';
import { scoreContent } from '@/lib/scoring';
import type { ContentItem, PublishTarget, Slot } from '@/types/domain';

// ─── Slots: 08:00 | 11:30 | 18:00 | 21:30 ───────────────────────────────────
const SLOTS: { slot: Slot; hour: number; minute: number }[] = [
  { slot: 'morning', hour: 8,  minute: 0  },
  { slot: 'midday',  hour: 11, minute: 30 },
  { slot: 'evening', hour: 18, minute: 0  },
  { slot: 'night',   hour: 21, minute: 30 },
];

export interface ScheduleResult {
  scheduled: Array<{ slot: Slot; contentId: string; score: number }>;
  skipped: number;
}

export async function selectAndScheduleVideos(): Promise<ScheduleResult> {
  const result: ScheduleResult = { scheduled: [], skipped: 0 };

  const { items: readyVideos } = await findContents({ status: 'ready', limit: 200 });

  const available = readyVideos
    .filter((v) => !v.selected_for_slot)
    .map((video) => ({
      video,
      score: scoreContent({
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
      }),
    }))
    .sort((a, b) => b.score - a.score);

  result.skipped = Math.max(0, SLOTS.length - available.length);

  for (let i = 0; i < SLOTS.length && i < available.length; i++) {
    const { slot, hour, minute } = SLOTS[i];
    const { video, score } = available[i];

    await setContentScheduled(video.id, slot);
    await createPublishJobsForVideo(video, slot, hour, minute);

    result.scheduled.push({ slot, contentId: video.id, score });
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
  hour: number,
  minute: number
): Promise<void> {
  const targets = await getActiveTargets();
  if (targets.length === 0) return;

  const scheduledFor = getSlotTime(hour, minute);

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

function getSlotTime(hour: number, minute: number): string {
  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);
  return scheduled.toISOString();
}

export async function manualSchedule(
  contentId: string,
  slot: Slot
): Promise<{ success: boolean; error?: string }> {
  const content = await findContentById(contentId);
  if (!content) return { success: false, error: 'Content not found' };
  if (content.status !== 'ready') {
    return { success: false, error: `Content status must be 'ready', got '${content.status}'` };
  }

  const slotDef = SLOTS.find((s) => s.slot === slot);
  const hour = slotDef?.hour ?? 8;
  const minute = slotDef?.minute ?? 0;

  await setContentScheduled(contentId, slot);
  await createPublishJobsForVideo(content, slot, hour, minute);

  return { success: true };
}
