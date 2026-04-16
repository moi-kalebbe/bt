import { findNewsItemById, findTodayStoryComposed, setNewsPublished, setNewsStatus } from '@/infra/supabase/repositories/news.repository';
import { getPublicUrl } from '@/infra/r2/client';
import { zernioStoryPost } from '@/infra/zernio/client';
import { metaInstagramStoryPost } from '@/infra/meta/instagram.client';
import { getNicheConfig } from '@/config/niche-configs';
import { getNicheSettings } from '@/infra/supabase/repositories/niche-settings.repository';

export interface PublishNewsResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export async function publishNewsStory(newsItemId: string): Promise<PublishNewsResult> {
  try {
    const item = await findNewsItemById(newsItemId);
    if (!item) return { success: false, error: 'News item not found' };

    if (!item.story_art_r2_key) {
      return { success: false, error: 'Story art not composed yet — run compose first' };
    }

    if (item.status !== 'story_composed') {
      return {
        success: false,
        error: `Expected status story_composed, got ${item.status}`,
      };
    }

    const imageUrl = getPublicUrl(item.story_art_r2_key);
    const niche = item.niche ?? 'beach-tennis';
    const [dbSettings, nicheConfig] = await Promise.all([
      getNicheSettings(niche).catch(() => null),
      Promise.resolve(getNicheConfig(niche)),
    ]);

    // Tenta Meta primeiro se configurado, cai no Zernio se falhar
    if (dbSettings?.meta_access_token && dbSettings?.meta_instagram_account_id) {
      const metaResult = await metaInstagramStoryPost(
        dbSettings.meta_access_token,
        dbSettings.meta_instagram_account_id,
        imageUrl
      );

      if (metaResult.success) {
        await setNewsPublished(newsItemId);
        return { success: true, postId: metaResult.postId };
      }
      console.warn(`[news-publish] Meta story falhou (${metaResult.error}), tentando Zernio...`);
    }

    // Zernio fallback
    const accountId = (dbSettings?.zernio_instagram_id) || nicheConfig.zernioAccountIds.instagram || undefined;
    const result = await zernioStoryPost('instagram', imageUrl, accountId);

    if (result.success) {
      await setNewsPublished(newsItemId);
      return { success: true, postId: result.postId };
    } else {
      await setNewsStatus(newsItemId, 'failed', `Publish error: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setNewsStatus(newsItemId, 'failed', `Publish error: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function publishTodayNews(niche?: string): Promise<{ published: number; failed: number }> {
  const items = await findTodayStoryComposed(niche);
  let published = 0;
  let failed = 0;

  for (const item of items) {
    const result = await publishNewsStory(item.id);
    if (result.success) {
      published++;
    } else {
      failed++;
      if (result.error?.toLowerCase().includes('daily limit')) break;
    }
  }

  return { published, failed };
}
