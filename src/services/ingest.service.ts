import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { findContentById, updateContentStatus, updateContentR2Keys } from '@/infra/supabase/repositories/content.repository';
import { uploadToR2 } from '@/infra/r2/client';
import { buildRawVideoPath, buildThumbnailPath } from '@/infra/r2/paths';
import { setContentProcessingError } from '@/infra/supabase/repositories/content.repository';
import type { ContentSource } from '@/types/domain';

export interface IngestResult {
  contentId: string;
  success: boolean;
  originalVideoKey?: string;
  thumbnailKey?: string;
  error?: string;
}

const DOWNLOAD_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
};

// Detecta se a URL é uma página de vídeo (não CDN direto)
function isPageUrl(url: string): boolean {
  return (
    url.includes('tiktok.com/') ||
    url.includes('youtube.com/') ||
    url.includes('youtu.be/')
  );
}

// Extrai a melhor URL disponível do raw_payload
function extractBestUrl(rawPayload: unknown): string | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const p = rawPayload as Record<string, unknown>;

  // URLs diretas de CDN (preferencial)
  if (typeof p.videoUrl === 'string' && p.videoUrl) return p.videoUrl;
  if (typeof p.downloadAddr === 'string' && p.downloadAddr) return p.downloadAddr;
  if (typeof p.playAddr === 'string' && p.playAddr) return p.playAddr;

  // Dentro de videoMeta
  if (p.videoMeta && typeof p.videoMeta === 'object') {
    const vm = p.videoMeta as Record<string, unknown>;
    if (typeof vm.downloadAddr === 'string' && vm.downloadAddr) return vm.downloadAddr;
    if (typeof vm.playAddr === 'string' && vm.playAddr) return vm.playAddr;
  }

  // mediaUrls[] (array de URLs diretas)
  if (Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0) {
    const first = p.mediaUrls[0];
    if (typeof first === 'string' && first) return first;
  }

  // Fallback: URL da página (requer yt-dlp)
  if (typeof p.webVideoUrl === 'string' && p.webVideoUrl) return p.webVideoUrl;
  if (typeof p.url === 'string' && p.url) return p.url;

  return null;
}

// Download via yt-dlp para URLs de página TikTok/YouTube
async function downloadViaYtDlp(pageUrl: string): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-'));
  const outTemplate = path.join(tmpDir, 'video.%(ext)s');

  // Usa YTDLP_PATH se configurado, senão tenta 'yt-dlp' no PATH
  const ytdlpBin = process.env.YTDLP_PATH ?? 'yt-dlp';

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ytdlpBin, [
      '-o', outTemplate,
      '--no-playlist',
      '--format', 'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--quiet',
      pageUrl,
    ]);

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      reject(new Error(
        `yt-dlp não encontrado em "${ytdlpBin}": ${err.message}. ` +
        `Configure YTDLP_PATH no .env.local ou instale: pip install yt-dlp`
      ));
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp falhou (código ${code}): ${stderr.slice(-300)}`));
    });
  });

  // Encontrar o arquivo gerado
  const files = await fs.readdir(tmpDir);
  const videoFile = files.find((f) => f.startsWith('video.'));
  if (!videoFile) throw new Error('yt-dlp não gerou arquivo de saída');

  const buffer = await fs.readFile(path.join(tmpDir, videoFile));
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  return buffer;
}

// Download direto via fetch para URLs CDN
async function downloadBuffer(url: string): Promise<Buffer> {
  if (isPageUrl(url)) {
    return downloadViaYtDlp(url);
  }

  const response = await fetch(url, { headers: DOWNLOAD_HEADERS });
  if (!response.ok) {
    throw new Error(`Download direto falhou: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function ingestContent(contentId: string): Promise<IngestResult> {
  try {
    const content = await findContentById(contentId);
    if (!content) {
      return { contentId, success: false, error: 'Content not found' };
    }

    await updateContentStatus(contentId, 'downloaded');

    const videoUrl = extractBestUrl(content.raw_payload);
    if (!videoUrl) {
      throw new Error(
        'Nenhuma URL de download encontrada no raw_payload ' +
        '(verificados: videoUrl, downloadAddr, playAddr, mediaUrls, webVideoUrl)'
      );
    }

    // Definir chaves R2
    const originalVideoKey = buildRawVideoPath(
      content.source as ContentSource,
      new Date(),
      content.id
    );
    const thumbnailKey = buildThumbnailPath(
      content.source as ContentSource,
      new Date(),
      content.id
    );

    const method = isPageUrl(videoUrl) ? 'yt-dlp' : 'CDN direto';
    console.log(`[ingest] Baixando vídeo via ${method}: ${videoUrl.slice(0, 80)}...`);

    const videoBuffer = await downloadBuffer(videoUrl);
    await uploadToR2(originalVideoKey, videoBuffer, { contentType: 'video/mp4' });
    console.log(`[ingest] Vídeo enviado para R2: ${originalVideoKey} (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

    // Thumbnail
    if (content.thumbnail_original_url) {
      try {
        const thumbResp = await fetch(content.thumbnail_original_url, { headers: DOWNLOAD_HEADERS });
        if (thumbResp.ok) {
          const thumbBuffer = Buffer.from(await thumbResp.arrayBuffer());
          await uploadToR2(thumbnailKey, thumbBuffer, { contentType: 'image/jpeg' });
        }
      } catch {
        // não bloqueia o ingest
      }
    }

    await updateContentR2Keys(contentId, {
      originalVideoR2Key: originalVideoKey,
      thumbnailR2Key: thumbnailKey,
    });

    await updateContentStatus(contentId, 'uploaded_r2');
    await updateContentStatus(contentId, 'ready');

    return { contentId, success: true, originalVideoKey, thumbnailKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await setContentProcessingError(contentId, `Ingest failed: ${errorMessage}`);
    return { contentId, success: false, error: errorMessage };
  }
}
