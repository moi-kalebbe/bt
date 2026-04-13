import { findContentById, setContentPublished } from '@/infra/supabase/repositories/content.repository';
import { updatePublishJobStatus } from '@/infra/supabase/repositories/publish-jobs.repository';
import { supabase } from '@/infra/supabase/client';
import { zernioPost, type ZernioPlatform } from '@/infra/zernio/client';
import { generateCaption } from '@/services/caption.service';
import type { PublishTarget } from '@/types/domain';

export interface PublishResult {
  contentId: string;
  platform: ZernioPlatform;
  success: boolean;
  publishedAt?: string;
  error?: string;
}

export async function publishVideo(
  contentId: string,
  platform: ZernioPlatform,
  publishJobId?: string
): Promise<PublishResult> {
  try {
    const content = await findContentById(contentId);
    if (!content) {
      return { contentId, platform, success: false, error: 'Content not found' };
    }

    if (!content.processed_video_r2_key) {
      return {
        contentId,
        platform,
        success: false,
        error: 'Processed video not available',
      };
    }

    const targets = await getActiveTargets(platform);
    if (targets.length === 0) {
      return {
        contentId,
        platform,
        success: false,
        error: `No active ${platform} target configured`,
      };
    }

    const videoUrl = getVideoPublicUrl(content.processed_video_r2_key);
    const caption = await generateCaption(content);

    const apiResult = await zernioPost(platform, videoUrl, caption);

    if (apiResult.success) {
      await setContentPublished(contentId, platform);

      if (publishJobId) {
        await updatePublishJobStatus(publishJobId, 'completed', {
          postId: apiResult.postId,
          publishedAt: new Date().toISOString(),
        });
      }

      return {
        contentId,
        platform,
        success: true,
        publishedAt: new Date().toISOString(),
      };
    } else {
      if (publishJobId) {
        await updatePublishJobStatus(
          publishJobId,
          'failed',
          undefined,
          apiResult.error
        );
      }

      return {
        contentId,
        platform,
        success: false,
        error: apiResult.error,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { contentId, platform, success: false, error: errorMessage };
  }
}

async function getActiveTargets(platform: ZernioPlatform): Promise<PublishTarget[]> {
  const { data, error } = await supabase
    .from('publish_targets')
    .select()
    .eq('platform', platform)
    .eq('active', true);

  if (error) throw error;
  return (data ?? []) as PublishTarget[];
}

function getVideoPublicUrl(r2Key: string): string {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('NEXT_PUBLIC_R2_PUBLIC_URL not configured');
  }
  return `${publicUrl}/${r2Key}`;
}
