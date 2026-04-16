import { createApifyClient } from './client';
import type { NormalizedContent } from '@/types/domain';

export interface TikTokVideo {
  id: string;
  url: string;           // página do vídeo
  webVideoUrl?: string;  // campo alternativo para URL da página
  videoUrl?: string;     // URL direta de download CDN
  downloadAddr?: string; // campo alternativo de download
  playAddr?: string;     // campo alternativo de download
  text: string;
  author: {
    username: string;
    displayName: string;
  };
  authorMeta?: {
    id?: string;
    name?: string;
    nickName?: string;
    fans?: number;       // seguidores do criador
    heart?: number;      // total de likes recebidos (lifetime)
    video?: number;      // total de vídeos publicados
    verified?: boolean;  // conta verificada
    signature?: string;
    profileUrl?: string;
  };
  createTime: number;
  hashtags: string[];
  videoMeta?: {
    duration?: number;
    coverUrl?: string;
    downloadLink?: string;
  };
  videoDuration?: number;
  thumbnailUrl?: string;
  covers?: { url?: string }[];
  // ── Métricas virais ─────────────────────────────────────────────────────
  playCount?:    number;  // visualizações/plays
  diggCount?:    number;  // likes ("digg" é o nome interno do TikTok)
  shareCount?:   number;  // compartilhamentos
  commentCount?: number;  // comentários
  collectCount?: number;  // saves / bookmarks
  repostCount?:  number;  // reposts
}

export interface TikTokScrapeResult {
  videos: TikTokVideo[];
  datasetId: string;
}

export async function scrapeTikTok(
  hashtags: string | string[],
  opts?: { token?: string }
): Promise<TikTokScrapeResult> {
  // Suporta múltiplos atores separados por vírgula
  const actorIdsEnv =
    process.env.APIFY_TIKTOK_ACTOR_IDS ?? process.env.APIFY_TIKTOK_ACTOR_ID;
  if (!actorIdsEnv) {
    throw new Error('APIFY_TIKTOK_ACTOR_IDS not configured');
  }

  const tagList = (Array.isArray(hashtags) ? hashtags : [hashtags])
    .map((t) => t.replace('#', ''));

  const actorIds = actorIdsEnv.split(',').map((s) => s.trim()).filter(Boolean);
  const client = createApifyClient(opts?.token);
  const allVideos: TikTokVideo[] = [];
  const seenIds = new Set<string>();
  const actorErrors: string[] = [];

  for (const actorId of actorIds) {
    try {
      console.log(`[tiktok] Rodando ator ${actorId} com hashtags: ${tagList.join(', ')}`);
      const input: Record<string, unknown> = {
        hashtags: tagList,
        resultsLimit: 2000,
        maxItems: 2000,
        limit: 2000,
      };
      const videos = await client.runActor<TikTokVideo>(actorId, input, 2000);
      for (const v of videos) {
        if (v.id && !seenIds.has(v.id)) {
          seenIds.add(v.id);
          allVideos.push(v);
        }
      }
      console.log(`[tiktok] ${actorId}: ${videos.length} vídeos coletados`);
      if (allVideos.length > 0) break; // achou com o primeiro ator, não precisa de fallback
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`[tiktok] Ator ${actorId} falhou: ${msg}`);
      actorErrors.push(`${actorId}: ${msg}`);
    }
  }

  if (allVideos.length === 0 && actorErrors.length > 0) {
    throw new Error(`Todos os atores falharam: ${actorErrors.join(' | ')}`);
  }

  return { videos: allVideos, datasetId: '' };
}

export function normalizeTikTokVideo(raw: TikTokVideo): NormalizedContent {
  const authorUsername =
    raw.author?.username ?? raw.authorMeta?.name ?? null;
  const authorDisplayName =
    raw.author?.displayName ?? raw.authorMeta?.nickName ?? authorUsername;
  const thumbnailUrl =
    raw.thumbnailUrl ?? raw.covers?.[0]?.url ?? raw.videoMeta?.coverUrl ?? null;
  const videoUrl =
    raw.videoUrl ?? raw.downloadAddr ?? raw.playAddr ?? raw.videoMeta?.downloadLink ?? null;
  const durationSeconds =
    raw.videoDuration ?? raw.videoMeta?.duration ?? null;

  return {
    source: 'tiktok',
    sourceVideoId: raw.id,
    sourceUrl: raw.url ?? raw.webVideoUrl ?? '',
    authorUsername,
    authorDisplayName,
    title: raw.text?.slice(0, 200) ?? null,
    description: raw.text ?? null,
    hashtags: Array.isArray(raw.hashtags) 
      ? raw.hashtags.map((h: any) => typeof h === 'string' ? h : h.name || h.text || '').filter(Boolean)
      : [],
    publishedAtSource: raw.createTime
      ? new Date(raw.createTime * 1000).toISOString()
      : null,
    thumbnailUrl,
    durationSeconds,
    rawPayload: raw,
  };
}

export interface TikTokSound {
  musicName: string;
  playUrl: string;
  authorName: string;
}

export async function scrapeTrendingSounds(hashtag: string = 'trendingsong', limit: number = 50): Promise<TikTokSound[]> {
  const actorIdsEnv = process.env.APIFY_TIKTOK_ACTOR_IDS ?? process.env.APIFY_TIKTOK_ACTOR_ID;
  if (!actorIdsEnv) throw new Error('APIFY_TIKTOK_ACTOR_IDS not configured');

  const actorIds = actorIdsEnv.split(',').map((s) => s.trim()).filter(Boolean);
  const client = createApifyClient();
  const sounds: TikTokSound[] = [];
  const seenUrls = new Set<string>();

  for (const actorId of actorIds) {
    try {
      console.log(`[tiktok-music] Escaneando sons pela hashtag: #${hashtag} no ator ${actorId}`);
      const input: Record<string, unknown> = {
        hashtags: [hashtag],
        resultsLimit: limit * 2, // Margem para sons duplicados
        maxItems: limit * 2,
        limit: limit * 2,
      };

      const videos = await client.runActor<TikTokVideo>(actorId, input, limit * 2);
      for (const v of videos) {
        if (sounds.length >= limit) break;

        const musicMeta: any = (v.videoMeta as any)?.musicMeta || (v as any).musicMeta || (v as any).music;
        if (musicMeta && musicMeta.playUrl) {
          if (!seenUrls.has(musicMeta.playUrl)) {
            seenUrls.add(musicMeta.playUrl);
            sounds.push({
              musicName: musicMeta.musicName || musicMeta.title || 'Música Desconhecida',
              playUrl: musicMeta.playUrl,
              authorName: musicMeta.musicAuthor || musicMeta.authorName || 'Efeitos/Desconhecido',
            });
          }
        }
      }
      if (sounds.length > 0) break; // achou suficientes no primeiro ator que rodou
    } catch (err) {
      console.error(`[tiktok-music] Falha ao extrair musicas no ator ${actorId}:`, err);
    }
  }

  return sounds;
}
