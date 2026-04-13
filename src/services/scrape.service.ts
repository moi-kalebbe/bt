import { scrapeTikTok, normalizeTikTokVideo } from '@/infra/apify/tiktok.scraper';
import { scrapeYouTubeShorts, normalizeYouTubeShort } from '@/infra/apify/youtube.scraper';
import { isBlockedAuthor, computeContentHash } from '@/domain/content';
import {
  createContent,
  findContentBySourceAndVideoId,
  findContentByHash,
} from '@/infra/supabase/repositories/content.repository';
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
  source: 'tiktok' | 'youtube' | 'both' = 'both'
): Promise<{
  results: ScrapeResult[];
  total: { collected: number; duplicates: number; blocked: number; queued: number; filteredOut: number };
}> {
  const results: ScrapeResult[] = [];

  if (source === 'tiktok' || source === 'both') {
    results.push(await scrapeAndIngest('tiktok'));
  }

  if (source === 'youtube' || source === 'both') {
    results.push(await scrapeAndIngest('youtube'));
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

async function scrapeAndIngest(source: ContentSource): Promise<ScrapeResult> {
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
    let normalizedVideos: NormalizedContent[] = [];

    if (source === 'tiktok') {
      // Quanto mais hashtags, mais variedade por run (ator ainda limita ~100 total mas é variado)
      const scrapeResult = await scrapeTikTok([
        'beachtennis',
        'beachtennisbrasil',
        'beachtennisplayer',
        'beachtennislovers',
        'beachtennislife',
        'beachtennis2026',
        'beachtennistorneio',
        'beachtennisfeminino',
        'beachtennismasculino',
        'beachtennis_',
      ]);
      normalizedVideos = scrapeResult.videos.map(normalizeTikTokVideo);
      result.collected = normalizedVideos.length;
    } else if (source === 'youtube') {
      const scrapeResult = await scrapeYouTubeShorts('beach tennis');
      normalizedVideos = scrapeResult.shorts.map(normalizeYouTubeShort);
      result.collected = normalizedVideos.length;
    }

    for (const video of normalizedVideos) {
      try {
        if (isBlockedAuthor(video.authorUsername, source)) {
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

        // Salvo como 'discovered' - o ingest é acionado separadamente
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
