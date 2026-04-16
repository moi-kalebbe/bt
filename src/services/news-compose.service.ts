import sharp from 'sharp';
import satori, { type SatoriOptions } from 'satori';
import fs from 'node:fs';
import path from 'node:path';
import { uploadToR2, getPublicUrl } from '@/infra/r2/client';
import { buildNewsStoryPath } from '@/infra/r2/paths';
import {
  findNewsItemById,
  findNewsByStatus,
  updateNewsItem,
  setNewsStatus,
} from '@/infra/supabase/repositories/news.repository';
import { getNicheConfig } from '@/config/niche-configs';
import type { NewsItem } from '@/types/domain';

export interface ComposeResult {
  success: boolean;
  storyArtKey?: string;
  error?: string;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920; // 9:16 — formato Story do Instagram
const COVER_H = 1150;  // hero image height (~60% of canvas)
const ACCENT = '#FF6B00'; // sports orange accent

// Lazy-loaded font cache — lido do disco uma vez por processo
type FontOptions = NonNullable<SatoriOptions['fonts']>[number];

let _fonts: FontOptions[] | null = null;
function getFonts(): FontOptions[] {
  if (!_fonts) {
    const base = path.join(process.cwd(), 'src/assets/fonts');
    _fonts = [
      { name: 'Inter', data: fs.readFileSync(path.join(base, 'Inter-Bold.woff2')), weight: 700, style: 'normal' },
      { name: 'Inter', data: fs.readFileSync(path.join(base, 'Inter-Regular.woff2')), weight: 400, style: 'normal' },
    ];
  }
  return _fonts;
}

export async function composeStoryArt(newsItemId: string): Promise<ComposeResult> {
  try {
    const item = await findNewsItemById(newsItemId);
    if (!item) return { success: false, error: 'News item not found' };

    if (!item.cover_image_r2_key && !item.cover_image_url) {
      return { success: false, error: 'No cover image available' };
    }

    const coverBuffer = await fetchCoverImage(item);
    if (!coverBuffer) return { success: false, error: 'Failed to download cover image' };

    // Layer 1 — background: blurred, darkened fill
    const bgBuffer = await sharp(coverBuffer)
      .resize(CANVAS_W, CANVAS_H, { fit: 'cover', position: 'centre' })
      .blur(12)
      .modulate({ brightness: 0.4 })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Layer 2 — hero image: full-width, covers top 60% of canvas
    const coverLayer = await sharp(coverBuffer)
      .resize(CANVAS_W, COVER_H, { fit: 'cover', position: 'top' })
      .jpeg({ quality: 95 })
      .toBuffer();

    // Layer 3 — gradient overlay (starts high, strong fade to black)
    const gradientTop = 550;
    const gradientHeight = CANVAS_H - gradientTop;
    const gradientBuffer = await sharp(
      Buffer.from(buildGradientSvg(CANVAS_W, gradientHeight))
    )
      .png()
      .toBuffer();

    // Layer 4 — text (Satori: fonte real, wrapping correto, sem dependência do sistema)
    const niche = item.niche ?? 'beach-tennis';
    const nicheConfig = getNicheConfig(niche);
    const textBuffer = await buildTextLayer(
      item.title,
      item.summary ?? '',
      item.source_name,
      nicheConfig.newsChipLabel,
      nicheConfig.newsTitlePrefixPattern,
      CANVAS_W,
      CANVAS_H,
    );

    // Composite all layers
    const result = await sharp(bgBuffer)
      .composite([
        { input: coverLayer, top: 0, left: 0 },
        { input: gradientBuffer, top: gradientTop, left: 0 },
        { input: textBuffer, top: 0, left: 0 },
      ])
      .jpeg({ quality: 88 })
      .toBuffer();

    const storyKey = buildNewsStoryPath(new Date(), newsItemId);
    await uploadToR2(storyKey, result, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    });

    await updateNewsItem(newsItemId, {
      story_art_r2_key: storyKey,
      status: 'story_composed',
      error_message: null,
    });

    return { success: true, storyArtKey: storyKey };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setNewsStatus(newsItemId, 'failed', `Compose error: ${msg}`);
    return { success: false, error: msg };
  }
}

/** Compõe story art para todos os itens com status 'curated' de um nicho. */
export async function composeAllCurated(niche?: string): Promise<{ composed: number; failed: number }> {
  const items = await findNewsByStatus('curated', 100, niche);
  let composed = 0;
  let failed = 0;

  for (const item of items) {
    const result = await composeStoryArt(item.id);
    if (result.success) composed++;
    else failed++;
  }

  return { composed, failed };
}

async function fetchCoverImage(
  item: Pick<NewsItem, 'cover_image_r2_key' | 'cover_image_url'>
): Promise<Buffer | null> {
  try {
    const url = item.cover_image_r2_key
      ? getPublicUrl(item.cover_image_r2_key)
      : item.cover_image_url!;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function buildGradientSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
        <stop offset="35%"  stop-color="#000000" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.97"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
  </svg>`;
}

/**
 * Gera a camada de texto via Satori — fonte Inter embarcada, wrapping real,
 * sem dependência de fontes do sistema (problema do librsvg).
 */
async function buildTextLayer(
  title: string,
  summary: string,
  sourceName: string,
  chipLabel: string,
  titlePrefixPattern: RegExp,
  canvasW: number,
  canvasH: number,
): Promise<Buffer> {
  const cleanTitle = truncateAtWord(title.replace(titlePrefixPattern, '').trim(), 80);
  const cleanSummary = truncateAtWord(summary, 160);

  // Satori aceita objetos VDOM plain em runtime; cast necessário pois os tipos pedem ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = {
    type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          width: canvasW,
          height: canvasH,
          paddingLeft: 72,
          paddingRight: 72,
          paddingBottom: 260,
          fontFamily: 'Inter',
          color: '#FFFFFF',
          position: 'relative',
        },
        children: [
          // Chip de categoria
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                backgroundColor: ACCENT,
                borderRadius: 4,
                paddingTop: 6,
                paddingBottom: 6,
                paddingLeft: 16,
                paddingRight: 16,
                marginBottom: 20,
                alignSelf: 'flex-start',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                color: '#FFFFFF',
              },
              children: chipLabel,
            },
          },
          // Título principal
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.25,
                marginBottom: 20,
                color: '#FFFFFF',
              },
              children: cleanTitle,
            },
          },
          // Linha divisora
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: 80,
                height: 3,
                backgroundColor: ACCENT,
                borderRadius: 2,
                marginBottom: 20,
              },
              children: '',
            },
          },
          // Resumo
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: 30,
                fontWeight: 400,
                color: '#D0D0D0',
                lineHeight: 1.55,
                marginBottom: 32,
              },
              children: cleanSummary,
            },
          },
          // Fonte/atribuição
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: 22,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.55)',
              },
              children: sourceName,
            },
          },
          // Barra de acento inferior
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: canvasW,
                height: 8,
                backgroundColor: ACCENT,
              },
              children: '',
            },
          },
        ],
      },
  };

  const svgString = await satori(element, {
    width: canvasW,
    height: canvasH,
    fonts: getFonts(),
  });

  return sharp(Buffer.from(svgString)).png().toBuffer();
}

function truncateAtWord(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max).replace(/\s+\S*$/, '');
  return cut + '…';
}
