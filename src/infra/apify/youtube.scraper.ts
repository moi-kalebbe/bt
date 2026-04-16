import { createApifyClient } from './client';
import type { NormalizedContent } from '@/types/domain';

export interface YouTubeShort {
  id: string;
  url: string;
  videoUrl?: string;     // URL direta de download (quando disponível)
  title: string;
  description: string;
  author: string;
  channelName?: string;  // campo alternativo para autor
  publishedAt: string;
  uploadDate?: string;   // campo alternativo para data
  thumbnailUrl?: string;
  bestThumbnail?: { url?: string }; // campo alternativo de thumbnail
  duration?: number;
  durationString?: string;
  // ── Métricas virais ─────────────────────────────────────────────────────
  viewCount?:    number;  // visualizações
  likeCount?:    number;  // likes
  commentCount?: number;  // comentários
  // Campos de autoridade do canal
  channelSubscriberCount?: number;
  isVerified?: boolean;
}

export interface YouTubeScrapeResult {
  shorts: YouTubeShort[];
  datasetId: string;
}

export async function scrapeYouTubeShorts(query: string): Promise<YouTubeScrapeResult> {
  // Suporta múltiplos atores separados por vírgula
  const actorIdsEnv =
    process.env.APIFY_YOUTUBE_ACTOR_IDS ?? process.env.APIFY_YOUTUBE_SHORTS_ACTOR_ID;
  if (!actorIdsEnv) {
    throw new Error('APIFY_YOUTUBE_ACTOR_IDS not configured');
  }

  const actorIds = actorIdsEnv.split(',').map((s) => s.trim()).filter(Boolean);
  const client = createApifyClient();
  const allShorts: YouTubeShort[] = [];
  const seenIds = new Set<string>();

  for (const actorId of actorIds) {
    try {
      console.log(`[youtube] Rodando ator: ${actorId}`);
      const input = buildYouTubeActorInput(actorId, query);
      const shorts = await client.runActor<YouTubeShort>(actorId, input, 100);
      for (const s of shorts) {
        if (s.id && !seenIds.has(s.id)) {
          seenIds.add(s.id);
          allShorts.push(s);
        }
      }
      console.log(`[youtube] ${actorId}: ${shorts.length} vídeos coletados`);
    } catch (err) {
      console.error(`[youtube] Ator ${actorId} falhou: ${err}`);
    }
  }

  return { shorts: allShorts, datasetId: '' };
}

/**
 * Builds actor-specific input to avoid strict schema validation errors (HTTP 400).
 * Each actor has its own field names for the same concepts.
 */
function buildYouTubeActorInput(actorId: string, query: string): Record<string, unknown> {
  const id = actorId.toLowerCase();

  // streamers/youtube-shorts-scraper
  if (id.includes('streamers')) {
    return { keyword: query, maxItems: 100, type: 'shorts' };
  }

  // apify/youtube-scraper (official)
  if (id.includes('apify/youtube')) {
    return { searchKeywords: query, maxResults: 100, type: 'shorts' };
  }

  // Generic fallback — send the most common field names, keep it small
  return {
    query,
    searchKeyword: query,
    searchKeywords: query,
    keyword: query,
    maxItems: 100,
    maxResults: 100,
    type: 'shorts',
  };
}

export function normalizeYouTubeShort(raw: YouTubeShort): NormalizedContent {
  const hashtags = (raw.description?.match(/#\w+/g) ?? []).map((tag) =>
    tag.slice(1).toLowerCase()
  );
  const author = raw.author ?? raw.channelName ?? null;
  const thumbnailUrl = raw.thumbnailUrl ?? raw.bestThumbnail?.url ?? null;
  const publishedAt = raw.publishedAt ?? raw.uploadDate ?? null;

  return {
    source: 'youtube',
    sourceVideoId: raw.id,
    sourceUrl: raw.url,
    authorUsername: author,
    authorDisplayName: author,
    title: raw.title?.slice(0, 200) ?? null,
    description: raw.description ?? null,
    hashtags,
    publishedAtSource: publishedAt,
    thumbnailUrl,
    durationSeconds: raw.duration ?? null,
    rawPayload: raw,
  };
}
