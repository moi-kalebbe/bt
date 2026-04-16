import { findNewsItemById, findTodayStoryComposed, setNewsPublished, setNewsStatus } from '@/infra/supabase/repositories/news.repository';
import { getPublicUrl } from '@/infra/r2/client';
import { zernioImagePost } from '@/infra/zernio/client';

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
    const caption = buildCaption(item.title);

    const result = await zernioImagePost('instagram', imageUrl, caption);

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

/** Publica todas as notícias do dia com story art pronto. */
export async function publishTodayNews(): Promise<{ published: number; failed: number }> {
  const items = await findTodayStoryComposed();
  let published = 0;
  let failed = 0;

  for (const item of items) {
    const result = await publishNewsStory(item.id);
    if (result.success) {
      published++;
    } else {
      failed++;
      // Se atingiu limite diário do Zernio, para imediatamente
      if (result.error?.toLowerCase().includes('daily limit')) break;
    }
  }

  return { published, failed };
}

function buildCaption(title: string): string {
  return `🎾 ${title}

Acesse o link na bio para ler a notícia completa!

@dicas.beachtennis

#beachtennis #beachtennisbrasil #beachtennislovers #beachtennisnotícias #esporte #tenis`;
}
