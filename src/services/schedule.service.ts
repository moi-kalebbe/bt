import {
  findContents,
  setContentScheduled,
  findContentById,
} from '@/infra/supabase/repositories/content.repository';
import { createPublishJob } from '@/infra/supabase/repositories/publish-jobs.repository';
import { supabase } from '@/infra/supabase/client';
import { scoreContent } from '@/lib/scoring';
import type { ContentItem, PublishTarget, Slot } from '@/types/domain';

const MORNING_HOUR = 8;
const NIGHT_HOUR = 18;

export interface ScheduleResult {
  morning: string | null;
  night: string | null;
  morningScore: number | null;
  nightScore: number | null;
}

export async function selectAndScheduleVideos(): Promise<ScheduleResult> {
  const result: ScheduleResult = {
    morning: null,
    night: null,
    morningScore: null,
    nightScore: null,
  };

  const { items: readyVideos } = await findContents({
    status: 'ready',
    limit: 100,
  });

  if (readyVideos.length === 0) {
    return result;
  }

  const scoredVideos = readyVideos
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

  if (scoredVideos.length >= 1) {
    const morningVideo = scoredVideos[0];
    await setContentScheduled(morningVideo.video.id, 'morning');
    await createPublishJobsForVideo(morningVideo.video, 'morning');
    result.morning = morningVideo.video.id;
    result.morningScore = morningVideo.score;
  }

  if (scoredVideos.length >= 2) {
    const nightVideo = scoredVideos[1];
    await setContentScheduled(nightVideo.video.id, 'night');
    await createPublishJobsForVideo(nightVideo.video, 'night');
    result.night = nightVideo.video.id;
    result.nightScore = nightVideo.score;
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
  slot: Slot
): Promise<void> {
  const targets = await getActiveTargets();
  if (targets.length === 0) return;

  const scheduledFor = getSlotScheduledTime(slot);

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

function getSlotScheduledTime(slot: Slot): string {
  const now = new Date();
  const scheduled = new Date(now);

  if (slot === 'morning') {
    scheduled.setHours(MORNING_HOUR, 0, 0, 0);
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
  } else {
    scheduled.setHours(NIGHT_HOUR, 0, 0, 0);
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
  }

  return scheduled.toISOString();
}

export async function manualSchedule(
  contentId: string,
  slot: Slot
): Promise<{ success: boolean; error?: string }> {
  const content = await findContentById(contentId);
  if (!content) {
    return { success: false, error: 'Content not found' };
  }

  if (content.status !== 'ready') {
    return { success: false, error: `Content status must be 'ready', got '${content.status}'` };
  }

  await setContentScheduled(contentId, slot);
  await createPublishJobsForVideo(content, slot);

  return { success: true };
}
