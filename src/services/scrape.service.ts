import { scrapeTikTok, normalizeTikTokVideo } from '@/infra/apify/tiktok.scraper';
import { scrapeYouTubeShorts, normalizeYouTubeShort } from '@/infra/apify/youtube.scraper';
import { isBlockedAuthor, computeContentHash } from '@/domain/content';
import {
  createContent,
  findContentBySourceAndVideoId,
  findContentByHash,
} from '@/infra/supabase/repositories/content.repository';
import { getNicheConfig, getApifyToken } from '@/config/niche-configs';
import type { NormalizedContent, ContentSource } from '@/types/domain';

export interface ScrapeResult {
  source: ContentSource;
  collected: number;
  duplicates: number;
  blocked: number;
  queued: number;
  filteredOut: number;
  errors: string[];
}

export async function runScrape(
  source: 'tiktok' | 'youtube' | 'both' = 'both',
  niche = 'beach-tennis'
): Promise<{
  results: ScrapeResult[];
  total: { collected: number; duplicates: number; blocked: number; queued: number; filteredOut: number };
}> {
  const results: ScrapeResult[] = [];

  if (source === 'tiktok' || source === 'both') {
    results.push(await scrapeAndIngest('tiktok', niche));
  }

  if (source === 'youtube' || source === 'both') {
    results.push(await scrapeAndIngest('youtube', niche));
  }

  const total = results.reduce(
    (acc, r) => ({
      collected: acc.collected + r.collected,
      duplicates: acc.duplicates + r.duplicates,
      blocked: acc.blocked + r.blocked,
      queued: acc.queued + r.queued,
      filteredOut: acc.filteredOut + r.filteredOut,
    }),
    { collected: 0, duplicates: 0, blocked: 0, queued: 0, filteredOut: 0 }
  );

  return { results, total };
}

async function scrapeAndIngest(source: ContentSource, niche: string): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    source,
    collected: 0,
    duplicates: 0,
    blocked: 0,
    queued: 0,
    filteredOut: 0,
    errors: [],
  };

  try {
    const config = getNicheConfig(niche);
    const apifyToken = getApifyToken(niche);
    let normalizedVideos: NormalizedContent[] = [];

    if (source === 'tiktok') {
      const scrapeResult = await scrapeTikTok(config.tiktokHashtags, { token: apifyToken });
      normalizedVideos = scrapeResult.videos.map(normalizeTikTokVideo);
      result.collected = normalizedVideos.length;
    } else if (source === 'youtube') {
      const scrapeResult = await scrapeYouTubeShorts(config.youtubeQuery, { token: apifyToken });
      normalizedVideos = scrapeResult.shorts.map(normalizeYouTubeShort);
      result.collected = normalizedVideos.length;
    }

    const rejectKeywords = config.videoRejectKeywords.map((k) => k.toLowerCase());

    for (const video of normalizedVideos) {
      try {
        // Verifica blacklist de autores do nicho
        const nicheBlockedAuthors = config.blockedAuthors[source] ?? [];
        const authorNorm = video.authorUsername?.toLowerCase().replace('@', '').trim() ?? '';
        if (nicheBlockedAuthors.includes(authorNorm) || isBlockedAuthor(video.authorUsername, source)) {
          result.blocked++;
          continue;
        }

        if (video.publishedAtSource) {
          const publishedYear = new Date(video.publishedAtSource).getFullYear();
          if (publishedYear !== 2026) {
            result.filteredOut++;
            continue;
          }
        }

        // Filtro por palavras-chave de rejeição (ex: vo3, midjourney, etc.)
        if (rejectKeywords.length > 0) {
          const titleLower = (video.title ?? '').toLowerCase();
          const descLower = (video.description ?? '').toLowerCase();
          const isRejected = rejectKeywords.some(
            (kw) => titleLower.includes(kw) || descLower.includes(kw)
          );
          if (isRejected) {
            result.filteredOut++;
            continue;
          }
        }

        const existingBySource = await findContentBySourceAndVideoId(
          source,
          video.sourceVideoId
        );
        if (existingBySource) {
          result.duplicates++;
          continue;
        }

        const contentHash = computeContentHash(video);
        const existingByHash = await findContentByHash(contentHash);
        if (existingByHash) {
          result.duplicates++;
          continue;
        }

        const contentItem = await createContent({
          source: video.source,
          sourceVideoId: video.sourceVideoId,
          sourceUrl: video.sourceUrl,
          niche,
          authorUsername: video.authorUsername,
          authorDisplayName: video.authorDisplayName,
          title: video.title,
          description: video.description,
          hashtags: video.hashtags,
          publishedAtSource: video.publishedAtSource,
          thumbnailUrl: video.thumbnailUrl,
          durationSeconds: video.durationSeconds,
          rawPayload: video.rawPayload,
          contentHash,
        });

        void contentItem;
        result.queued++;
      } catch (error) {
        const msg = error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
        result.errors.push(`Erro ao processar ${video.sourceVideoId}: ${msg}`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error
      ? error.message
      : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error);
    result.errors.push(`Scrape error: ${msg}`);
  }

  return result;
}
