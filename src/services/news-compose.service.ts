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
import { getRandomActiveTemplate } from '@/infra/supabase/repositories/story-templates.repository';
import { getNicheConfig } from '@/config/niche-configs';
import type { NewsItem } from '@/types/domain';
import type {
  StoryTemplateConfig,
  AnyLayer,
  BackgroundBlurLayer,
  ImageLayer,
  GradientLayer,
  TextLayer,
  ShapeLayer,
} from '@/types/story-template';

export interface ComposeResult {
  success: boolean;
  storyArtKey?: string;
  error?: string;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const COVER_H = 1150;
const ACCENT = '#FF6B00';

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

export interface TemplateRenderData {
  title: string;
  summary: string;
  sourceName: string;
  chipLabel: string;
  titlePrefixPattern: RegExp;
  coverBuffer: Buffer;
}

// ─── Template renderer (exportado para uso pela preview API) ──────────────────

export async function renderTemplateToBuffer(
  config: StoryTemplateConfig,
  data: TemplateRenderData,
  opts: { quality?: number } = {},
): Promise<Buffer> {
  const blurLayer = config.layers.find(
    (l): l is BackgroundBlurLayer => l.type === 'background_blur' && l.visible,
  );

  const baseBuffer = await sharp(data.coverBuffer)
    .resize(CANVAS_W, CANVAS_H, { fit: 'cover', position: 'centre' })
    .blur(blurLayer?.blurRadius ?? 12)
    .modulate({ brightness: blurLayer?.brightness ?? 0.4 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const compositeInputs: sharp.OverlayOptions[] = [];

  for (const layer of config.layers) {
    if (!layer.visible || layer.type === 'background_blur') continue;
    const input = await renderLayerToInput(layer, data, config);
    if (input) compositeInputs.push(input);
  }

  return sharp(baseBuffer)
    .composite(compositeInputs)
    .jpeg({ quality: opts.quality ?? 88 })
    .toBuffer();
}

async function renderLayerToInput(
  layer: AnyLayer,
  data: TemplateRenderData,
  config: StoryTemplateConfig,
): Promise<sharp.OverlayOptions | null> {
  switch (layer.type) {
    case 'image':
      return renderImageLayer(layer, data.coverBuffer);
    case 'gradient':
      return renderGradientLayer(layer);
    case 'text':
      return renderTextLayer(layer, data, config);
    case 'shape':
      return renderShapeLayer(layer);
    default:
      return null;
  }
}

async function renderImageLayer(
  layer: ImageLayer,
  coverBuffer: Buffer,
): Promise<sharp.OverlayOptions> {
  const fitMap: Record<string, 'cover' | 'contain' | 'fill'> = {
    cover: 'cover',
    contain: 'contain',
    fill: 'fill',
  };
  const posMap: Record<string, 'top' | 'centre' | 'bottom'> = {
    top: 'top',
    center: 'centre',
    bottom: 'bottom',
  };

  const buf = await sharp(coverBuffer)
    .resize(layer.width, layer.height, {
      fit: fitMap[layer.fit] ?? 'cover',
      position: posMap[layer.position] ?? 'centre',
    })
    .jpeg({ quality: 95 })
    .toBuffer();

  return { input: buf, top: layer.y, left: layer.x };
}

async function renderGradientLayer(layer: GradientLayer): Promise<sharp.OverlayOptions> {
  const dirMap: Record<string, string> = {
    'to-bottom': 'x1="0" y1="0" x2="0" y2="1"',
    'to-top': 'x1="0" y1="1" x2="0" y2="0"',
    'to-right': 'x1="0" y1="0" x2="1" y2="0"',
    'to-left': 'x1="1" y1="0" x2="0" y2="0"',
  };

  const gradientCoords = dirMap[layer.direction] ?? dirMap['to-bottom'];
  const stops = layer.stops
    .map(
      (s) =>
        `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`,
    )
    .join('\n        ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layer.width}" height="${layer.height}">
    <defs>
      <linearGradient id="g" ${gradientCoords}>
        ${stops}
      </linearGradient>
    </defs>
    <rect width="${layer.width}" height="${layer.height}" fill="url(#g)"/>
  </svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return { input: buf, top: layer.y, left: layer.x };
}

async function renderTextLayer(
  layer: TextLayer,
  data: TemplateRenderData,
  config: StoryTemplateConfig,
): Promise<sharp.OverlayOptions | null> {
  if (layer.source === 'full_text_block') {
    const buf = await buildTextLayer(
      data.title,
      data.summary,
      data.sourceName,
      data.chipLabel,
      data.titlePrefixPattern,
      CANVAS_W,
      CANVAS_H,
    );
    return { input: buf, top: 0, left: 0 };
  }

  const text = resolveTextContent(layer, data);
  if (!text) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: CANVAS_W,
        height: CANVAS_H,
        position: 'relative',
        fontFamily: 'Inter',
      },
      children: {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            position: 'absolute',
            top: layer.y,
            left: layer.x,
            width: layer.width,
            ...(layer.height ? { maxHeight: layer.height } : {}),
            fontSize: layer.fontSize,
            fontWeight: layer.fontWeight,
            color: layer.color,
            lineHeight: layer.lineHeight,
            ...(layer.letterSpacing ? { letterSpacing: layer.letterSpacing } : {}),
            ...(layer.backgroundColor
              ? {
                  backgroundColor: layer.backgroundColor,
                  paddingTop: layer.paddingY ?? 6,
                  paddingBottom: layer.paddingY ?? 6,
                  paddingLeft: layer.paddingX ?? 16,
                  paddingRight: layer.paddingX ?? 16,
                  borderRadius: layer.borderRadius ?? 4,
                  alignSelf: layer.alignSelf ?? 'flex-start',
                }
              : {}),
          },
          children: text,
        },
      },
    },
  };

  const svgString = await satori(element, {
    width: CANVAS_W,
    height: CANVAS_H,
    fonts: getFonts(),
  });

  const buf = await sharp(Buffer.from(svgString)).png().toBuffer();
  return { input: buf, top: 0, left: 0 };
}

async function renderShapeLayer(layer: ShapeLayer): Promise<sharp.OverlayOptions> {
  const resolvedWidth = layer.width === 'full' ? CANVAS_W : layer.width;
  const resolvedY =
    layer.anchor === 'absolute' && layer.bottom !== undefined
      ? CANVAS_H - layer.height - layer.bottom
      : layer.y;
  const resolvedX =
    layer.anchor === 'absolute' && layer.left !== undefined ? layer.left : layer.x;

  const radius = layer.borderRadius ?? 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${resolvedWidth}" height="${layer.height}">
    <rect width="${resolvedWidth}" height="${layer.height}" rx="${radius}" ry="${radius}" fill="${layer.backgroundColor}"/>
  </svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return { input: buf, top: resolvedY, left: resolvedX };
}

function resolveTextContent(layer: TextLayer, data: TemplateRenderData): string {
  switch (layer.source) {
    case 'title':
      return truncateAtWord(
        data.title.replace(data.titlePrefixPattern, '').trim(),
        layer.truncateAt ?? 80,
      );
    case 'summary':
      return truncateAtWord(data.summary, layer.truncateAt ?? 160);
    case 'source_name':
      return data.sourceName;
    case 'niche_label':
      return data.chipLabel;
    case 'custom':
      return layer.customValue ?? '';
    default:
      return '';
  }
}

// ─── Legacy pipeline (mantém comportamento idêntico ao original) ───────────────

async function legacyComposeBuffer(
  coverBuffer: Buffer,
  item: Pick<NewsItem, 'title' | 'summary' | 'source_name' | 'niche'>,
  nicheConfig: { newsChipLabel: string; newsTitlePrefixPattern: RegExp },
): Promise<Buffer> {
  const bgBuffer = await sharp(coverBuffer)
    .resize(CANVAS_W, CANVAS_H, { fit: 'cover', position: 'centre' })
    .blur(12)
    .modulate({ brightness: 0.4 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const coverLayer = await sharp(coverBuffer)
    .resize(CANVAS_W, COVER_H, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 95 })
    .toBuffer();

  const gradientTop = 550;
  const gradientHeight = CANVAS_H - gradientTop;
  const gradientBuffer = await sharp(Buffer.from(buildGradientSvg(CANVAS_W, gradientHeight)))
    .png()
    .toBuffer();

  const niche = item.niche ?? 'beach-tennis';
  const config = nicheConfig;
  const textBuffer = await buildTextLayer(
    item.title,
    item.summary ?? '',
    item.source_name,
    config.newsChipLabel,
    config.newsTitlePrefixPattern,
    CANVAS_W,
    CANVAS_H,
  );

  return sharp(bgBuffer)
    .composite([
      { input: coverLayer, top: 0, left: 0 },
      { input: gradientBuffer, top: gradientTop, left: 0 },
      { input: textBuffer, top: 0, left: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// ─── Ponto de entrada principal ───────────────────────────────────────────────

export async function composeStoryArt(newsItemId: string): Promise<ComposeResult> {
  try {
    const item = await findNewsItemById(newsItemId);
    if (!item) return { success: false, error: 'News item not found' };

    if (!item.cover_image_r2_key && !item.cover_image_url) {
      return { success: false, error: 'No cover image available' };
    }

    const coverBuffer = await fetchCoverImage(item);
    if (!coverBuffer) return { success: false, error: 'Failed to download cover image' };

    const niche = item.niche ?? 'beach-tennis';
    const nicheConfig = getNicheConfig(niche);

    const template = await getRandomActiveTemplate(niche).catch(() => null);

    const result = template
      ? await renderTemplateToBuffer(template.config, {
          title: item.title,
          summary: item.summary ?? '',
          sourceName: item.source_name,
          chipLabel: nicheConfig.newsChipLabel,
          titlePrefixPattern: nicheConfig.newsTitlePrefixPattern,
          coverBuffer,
        })
      : await legacyComposeBuffer(coverBuffer, item, nicheConfig);

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
