import sharp from 'sharp';
import { uploadToR2, getPublicUrl } from '@/infra/r2/client';
import { buildNewsStoryPath } from '@/infra/r2/paths';
import {
  findNewsItemById,
  findNewsByStatus,
  updateNewsItem,
  setNewsStatus,
} from '@/infra/supabase/repositories/news.repository';
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

    const coverLeft = 0;

    // Layer 3 — gradient overlay (starts high, strong fade to black)
    const gradientTop = 550;
    const gradientHeight = CANVAS_H - gradientTop;
    const gradientBuffer = await sharp(
      Buffer.from(buildGradientSvg(CANVAS_W, gradientHeight))
    )
      .png()
      .toBuffer();

    // Layer 4 — text SVG (branding, category chip, title, summary, source)
    const textBuffer = await sharp(
      Buffer.from(buildTextSvg(item.title, item.summary ?? '', item.source_name, CANVAS_W, CANVAS_H))
    )
      .png()
      .toBuffer();

    // Composite all layers
    const result = await sharp(bgBuffer)
      .composite([
        { input: coverLayer, top: 0, left: coverLeft },
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

/** Compõe story art para todos os itens com status 'curated'. */
export async function composeAllCurated(): Promise<{ composed: number; failed: number }> {
  const items = await findNewsByStatus('curated');
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

function buildTextSvg(
  title: string,
  summary: string,
  sourceName: string,
  canvasW: number,
  canvasH: number
): string {
  const MARGIN = 72;
  const TITLE_LINE_H = 72;
  const SUMMARY_LINE_H = 46;

  const titleLines = wrapText(title, 52, canvasW - MARGIN * 2).slice(0, 4);
  const summaryLines = wrapText(summary, 28, canvasW - MARGIN * 2).slice(0, 3);

  // Build content from bottom up
  const SOURCE_Y = canvasH - 32;         // source attribution near bottom
  const summaryEndY = SOURCE_Y - 56;     // last summary line baseline
  const summaryStartY = summaryEndY - (summaryLines.length - 1) * SUMMARY_LINE_H;
  const RULE_Y = summaryStartY - 28;     // accent divider line
  const titleEndY = RULE_Y - 36;
  const titleStartY = titleEndY - (titleLines.length - 1) * TITLE_LINE_H;
  const CHIP_Y = titleStartY - 56;       // category chip baseline

  // Chip dimensions (estimate ~14px per char at font-size 20)
  const CHIP_LABEL = 'BEACH TENNIS';
  const CHIP_W = 208;
  const CHIP_H = 38;

  const titleSvg = titleLines
    .map(
      (line, i) => `
    <text x="${MARGIN}" y="${titleStartY + i * TITLE_LINE_H}"
      font-size="56" font-weight="bold" fill="#FFFFFF"
      font-family="Arial, Helvetica, sans-serif"
      filter="url(#shadow)">${escapeXml(line)}</text>`
    )
    .join('');

  const summarySvg = summaryLines.length
    ? summaryLines
        .map(
          (line, i) => `
    <text x="${MARGIN}" y="${summaryStartY + i * SUMMARY_LINE_H}"
      font-size="30" fill="#D0D0D0"
      font-family="Arial, Helvetica, sans-serif"
      filter="url(#shadowLight)">${escapeXml(line)}</text>`
        )
        .join('')
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
    <defs>
      <filter id="shadow" x="-5%" y="-10%" width="115%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="6"
          flood-color="#000000" flood-opacity="0.9"/>
      </filter>
      <filter id="shadowLight" x="-5%" y="-10%" width="115%" height="130%">
        <feDropShadow dx="0" dy="1" stdDeviation="3"
          flood-color="#000000" flood-opacity="0.7"/>
      </filter>
      <linearGradient id="topBar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Top branding bar -->
    <rect width="${canvasW}" height="140" fill="url(#topBar)"/>
    <text x="${canvasW / 2}" y="82"
      font-size="28" fill="#FFFFFF" font-weight="bold" font-style="italic"
      font-family="Arial, Helvetica, sans-serif"
      text-anchor="middle" filter="url(#shadowLight)"
      opacity="0.92">@dicas.beachtennis</text>

    <!-- Category chip -->
    <rect x="${MARGIN}" y="${CHIP_Y - CHIP_H + 6}"
      width="${CHIP_W}" height="${CHIP_H}"
      rx="4" fill="${ACCENT}"/>
    <text x="${MARGIN + 16}" y="${CHIP_Y - 4}"
      font-size="20" fill="#FFFFFF" font-weight="bold"
      font-family="Arial, Helvetica, sans-serif"
      letter-spacing="2">${CHIP_LABEL}</text>

    <!-- Title -->
    ${titleSvg}

    <!-- Accent divider line -->
    <rect x="${MARGIN}" y="${RULE_Y}" width="80" height="3" rx="2" fill="${ACCENT}"/>

    <!-- Summary -->
    ${summarySvg}

    <!-- Source attribution -->
    <text x="${MARGIN}" y="${SOURCE_Y}"
      font-size="22" fill="#FFFFFF" opacity="0.55"
      font-family="Arial, Helvetica, sans-serif"
      filter="url(#shadowLight)">${escapeXml(sourceName)}</text>

    <!-- Bottom accent bar -->
    <rect x="0" y="${canvasH - 8}" width="${canvasW}" height="8" fill="${ACCENT}"/>
  </svg>`;
}

/**
 * Approximate word-wrap using character count as proxy for pixel width.
 * librsvg doesn't support glyph measurement at compose time, so we use
 * conservative char limits. For 44px bold: ~22 chars/line at 952px usable width.
 * For 28px regular: ~38 chars/line.
 */
function wrapText(text: string, fontSize: number, usableWidth: number): string[] {
  if (!text) return [];

  // Empirical: ~0.55 × fontSize gives average char width for Arial
  const avgCharW = fontSize * 0.55;
  const maxChars = Math.floor(usableWidth / avgCharW);

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
