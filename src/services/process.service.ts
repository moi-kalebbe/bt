import { findContentById, updateContentStatus, updateContentR2Keys } from '@/infra/supabase/repositories/content.repository';
import { setContentProcessingError } from '@/infra/supabase/repositories/content.repository';
import { buildProcessedVideoPath } from '@/infra/r2/paths';
import { getRandomActiveTrack } from '@/infra/supabase/repositories/viral_tracks.repository';
import type { ProcessingProfile } from '@/types/domain';

const FFMPEG_WORKER_URL = process.env.FFMPEG_WORKER_URL ?? 'http://localhost:3001';

export interface ProcessResult {
  contentId: string;
  success: boolean;
  processedVideoKey?: string;
  error?: string;
}

export async function processVideo(
  contentId: string,
  trackId?: string,
  profile: ProcessingProfile = 'reels'
): Promise<ProcessResult> {
  try {
    const content = await findContentById(contentId);
    if (!content) {
      return { contentId, success: false, error: 'Content not found' };
    }

    if (!content.original_video_r2_key) {
      return { contentId, success: false, error: 'Original video not uploaded to R2' };
    }

    await updateContentStatus(contentId, 'processing');

    const processedVideoKey = buildProcessedVideoPath(new Date(), contentId);

    let actualTrackId = trackId;
    if (!actualTrackId) {
      const randomTrack = await getRandomActiveTrack();
      actualTrackId = randomTrack?.r2_key ?? undefined;
    }

    const response = await fetch(`${FFMPEG_WORKER_URL}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentId,
        originalVideoKey: content.original_video_r2_key,
        processedVideoKey,
        trackId: actualTrackId,
        profile,
      }),
    });

    if (!response.ok) {
      throw new Error(`FFmpeg worker error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error ?? 'Unknown FFmpeg worker error');
    }

    await updateContentR2Keys(contentId, {
      processedVideoR2Key: processedVideoKey,
    });

    await updateContentStatus(contentId, 'ready');

    return {
      contentId,
      success: true,
      processedVideoKey,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await setContentProcessingError(contentId, `Processing failed: ${errorMessage}`);
    return { contentId, success: false, error: errorMessage };
  }
}

export async function processCallback(
  contentId: string,
  success: boolean,
  processedVideoKey?: string,
  processingError?: string
): Promise<void> {
  if (success && processedVideoKey) {
    await updateContentR2Keys(contentId, {
      processedVideoR2Key: processedVideoKey,
    });
    await updateContentStatus(contentId, 'ready');
  } else {
    await setContentProcessingError(contentId, processingError ?? 'Unknown processing error');
  }
}
