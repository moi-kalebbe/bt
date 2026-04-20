import { findContentById, setContentPublished } from '@/infra/supabase/repositories/content.repository';
import { updatePublishJobStatus } from '@/infra/supabase/repositories/publish-jobs.repository';
import { getNicheSettings } from '@/infra/supabase/repositories/niche-settings.repository';
import { supabase } from '@/infra/supabase/client';
import { zernioPost, type ZernioPlatform, type ZernioResult } from '@/infra/zernio/client';
import { metaInstagramPost } from '@/infra/meta/instagram.client';
import { generateCaption } from '@/services/caption.service';
import { getNicheConfig } from '@/config/niche-configs';
import type { PublishTarget } from '@/types/domain';

export interface PublishResult {
  contentId: string;
  platform: ZernioPlatform;
  success: boolean;
  publishedAt?: string;
  error?: string;
  dailyLimitReached?: boolean;
}

export async function publishVideo(
  contentId: string,
  platform: ZernioPlatform,
  publishJobId?: string
): Promise<PublishResult> {
  try {
    const content = await findContentById(contentId);
    if (!content) {
      if (publishJobId) {
        await updatePublishJobStatus(publishJobId, 'failed', undefined, 'Content not found');
      }
      return { contentId, platform, success: false, error: 'Content not found' };
    }

    if (!content.processed_video_r2_key) {
      if (publishJobId) {
        await updatePublishJobStatus(publishJobId, 'failed', undefined, 'Processed video not available');
      }
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

    const niche = content.niche ?? 'beach-tennis';
    const [dbSettings, staticConfig] = await Promise.all([
      getNicheSettings(niche).catch(() => null),
      Promise.resolve(getNicheConfig(niche)),
    ]);

    let apiResult: ZernioResult;
    let instagramMediaId: string | undefined;

    if (platform === 'instagram') {
      if (!dbSettings?.meta_access_token || !dbSettings?.meta_instagram_account_id) {
        if (publishJobId) {
          await updatePublishJobStatus(
            publishJobId,
            'failed',
            undefined,
            'Meta credentials not configured for Instagram'
          );
        }
        return {
          contentId,
          platform,
          success: false,
          error: 'Meta credentials not configured for Instagram',
        };
      }

      const metaResult = await metaInstagramPost(
        dbSettings.meta_access_token,
        dbSettings.meta_instagram_account_id,
        videoUrl,
        caption
      );

      if (metaResult.success) {
        apiResult = { success: true, postId: metaResult.postId };
        instagramMediaId = metaResult.mediaId ?? metaResult.postId;
      } else {
        apiResult = {
          success: false,
          error: metaResult.error,
          dailyLimitReached: metaResult.dailyLimitReached,
        };
      }
    } else {
      const zernioIdKey = `zernio_${platform}_id` as keyof typeof dbSettings;
      const accountId =
        (dbSettings?.[zernioIdKey] as string | null | undefined) ||
        staticConfig.zernioAccountIds[platform] || undefined;
      apiResult = await zernioPost(platform, videoUrl, caption, accountId);
    }

    if (apiResult.success) {
      await setContentPublished(contentId, platform, instagramMediaId);

      if (publishJobId) {
        await updatePublishJobStatus(publishJobId, 'completed', {
          postId: apiResult.postId,
          instagramMediaId: instagramMediaId ?? apiResult.postId,
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
        dailyLimitReached: apiResult.dailyLimitReached,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (publishJobId) {
      await updatePublishJobStatus(publishJobId, 'failed', undefined, errorMessage).catch(() => {});
    }
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
