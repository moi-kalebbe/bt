import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import {
  createNewsItem,
  findNewsItemByUrl,
  setNewsStatus,
  updateNewsItem,
} from '@/infra/supabase/repositories/news.repository';
import { uploadToR2 } from '@/infra/r2/client';
import { buildNewsImagePath } from '@/infra/r2/paths';
import { getNicheConfig } from '@/config/niche-configs';

export interface FetchNewsResult {
  discovered: number;
  duplicates: number;
  scraped: number;
  failed: number;
  errors: string[];
}

// Caminhos de RSS comuns para tentar nos domínios fonte
const RSS_PATHS = [
  '/feed/',
  '/rss/',
  '/rss.xml',
  '/feed.xml',
  '/feeds/posts/default',
  '/api/rss',
  '/noticias/feed/',
  '/esportes/feed/',
];

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentBot/1.0)' },
  customFields: {
    item: [['source', 'sourceTag']],
  },
});

// Cache dos feeds dos domínios fonte (por run)
const sourceFeedCache = new Map<string, { link: string; title: string }[]>();

// Mapeamento de nomes de fonte (do Google News) para domínios reais
const SOURCE_DOMAIN_MAP: Record<string, string> = {
  'g1':                    'g1.globo.com',
  'globo':                 'g1.globo.com',
  'terra':                 'terra.com.br',
  'uol':                   'esporte.uol.com.br',
  'lance':                 'lance.com.br',
  'espn':                  'espn.com.br',
  'tenisbrasil':           'tenisbrasil.com.br',
  'cbt':                   'cbt.org.br',
  'btbrasil':              'btbrasil.com.br',
  'correio braziliense':   'correiobraziliense.com.br',
  'r7':                    'r7.com',
  'estadao':               'estadao.com.br',
  'folha de s.paulo':      'folha.uol.com.br',
  'metropolitan':          'metropolitan.com.br',
  'dn':                    'dn.pt',
  'beach tennis news':     'beachtennis.news',
  // AI/Tech
  'the verge':             'theverge.com',
  'techcrunch':            'techcrunch.com',
  'venturebeat':           'venturebeat.com',
  'mit technology review': 'technologyreview.com',
  'ars technica':          'arstechnica.com',
  'olhar digital':         'olhardigital.com.br',
  'canaltech':             'canaltech.com.br',
  'wired':                 'wired.com',
};

export async function fetchNicheNews(niche = 'beach-tennis'): Promise<FetchNewsResult> {
  const config = getNicheConfig(niche);
  sourceFeedCache.clear(); // limpa cache a cada run

  const result: FetchNewsResult = {
    discovered: 0,
    duplicates: 0,
    scraped: 0,
    failed: 0,
    errors: [],
  };

  for (const source of config.newsSources) {
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      result.errors.push(
        `[${source.name}] RSS fetch error: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const item of feed.items ?? []) {
      try {
        // Filtro por palavra-chave (para portais gerais)
        if (source.filterKeyword) {
          const titleLower = (item.title ?? '').toLowerCase();
          const descLower = (item.contentSnippet ?? item.summary ?? '').toLowerCase();
          const kw = source.filterKeyword.toLowerCase();
          if (!titleLower.includes(kw) && !descLower.includes(kw)) continue;
        }

        const rawTitle = item.title ?? '';
        const cleanTitle = source.needsResolution
          ? rawTitle.replace(/\s*[-–]\s*[\w.]+\.(com|br|net|org|io)\s*$/, '').trim() || rawTitle
          : rawTitle;

        let resolvedUrl: string | null = null;

        if (source.needsResolution) {
          const googleNewsLink = item.link ?? '';
          if (!googleNewsLink) {
            result.failed++;
            continue;
          }

          const sourceTag = (item as unknown as Record<string, unknown>)['sourceTag'] as
            | { $?: { url?: string } }
            | string
            | undefined;
          const sourceDomain = extractSourceDomain(sourceTag, rawTitle);

          resolvedUrl = sourceDomain
            ? await resolveViaSourceRss(sourceDomain, cleanTitle)
            : null;

          if (!resolvedUrl) {
            result.failed++;
            continue;
          }
        } else {
          resolvedUrl = item.link ?? item.guid ?? null;
          if (!resolvedUrl || isGoogleOrigin(resolvedUrl)) {
            result.failed++;
            continue;
          }
        }

        const existing = await findNewsItemByUrl(resolvedUrl);
        if (existing) {
          result.duplicates++;
          continue;
        }

        const author = item.creator ?? (item as unknown as Record<string, unknown>)['author'] as string ?? null;

        const newsItem = await createNewsItem({
          title: cleanTitle || rawTitle,
          sourceUrl: resolvedUrl,
          sourceName: source.name,
          niche,
          summary: null,
          author,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        });

        result.discovered++;

        const ok = await scrapeArticle(newsItem.id, resolvedUrl);
        if (ok) {
          result.scraped++;
        } else {
          result.failed++;
        }
      } catch (err) {
        result.failed++;
        result.errors.push(
          `[${source.name}] Item error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return result;
}

/** @deprecated Use fetchNicheNews('beach-tennis') */
export async function fetchBeachTennisNews(): Promise<FetchNewsResult> {
  return fetchNicheNews('beach-tennis');
}

function isGoogleOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'news.google.com' ||
      hostname.endsWith('.google.com') ||
      hostname.endsWith('.google.com.br') ||
      hostname === 'www.google.com'
    );
  } catch {
    return true;
  }
}

function extractSourceDomain(
  sourceTag: { $?: { url?: string } } | string | undefined,
  itemTitle?: string
): string | null {
  let raw = '';
  if (typeof sourceTag === 'object' && sourceTag?.$?.url) {
    raw = sourceTag.$.url;
  } else if (typeof sourceTag === 'string') {
    raw = sourceTag;
  }

  if (raw && raw.includes('.')) {
    try {
      const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      return parsed.hostname;
    } catch {
      // fall through
    }
  }

  const key = raw.toLowerCase().trim();
  if (key && SOURCE_DOMAIN_MAP[key]) return SOURCE_DOMAIN_MAP[key];

  if (itemTitle) {
    const suffix = itemTitle.match(/[-–]\s*([\w.\s]+)\s*$/)?.[1]?.trim();
    if (suffix) {
      if (suffix.includes('.')) {
        try {
          return new URL(`https://${suffix}`).hostname;
        } catch { /* fall through */ }
      }
      const suffixKey = suffix.toLowerCase();
      if (SOURCE_DOMAIN_MAP[suffixKey]) return SOURCE_DOMAIN_MAP[suffixKey];
    }
  }

  return null;
}

async function resolveViaSourceRss(domain: string, title: string): Promise<string | null> {
  if (!sourceFeedCache.has(domain)) {
    const items = await fetchSourceFeedItems(domain);
    sourceFeedCache.set(domain, items);
  }

  const items = sourceFeedCache.get(domain) ?? [];
  if (items.length === 0) return null;

  const titleWords = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (titleWords.length < 2) return null;

  for (const feedItem of items) {
    const feedTitle = feedItem.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const matches = titleWords.filter((w) => feedTitle.includes(w));
    if (matches.length >= Math.min(3, titleWords.length)) {
      return feedItem.link;
    }
  }

  return null;
}

async function fetchSourceFeedItems(domain: string): Promise<{ link: string; title: string }[]> {
  for (const path of RSS_PATHS) {
    const url = `https://${domain}${path}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) continue;

      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('xml') && !ct.includes('rss') && !ct.includes('atom')) continue;

      const xml = await res.text();
      if (!xml.includes('<item>') && !xml.includes('<entry>')) continue;

      const feed = await parser.parseString(xml);
      const items = (feed.items ?? [])
        .map((i) => ({ link: i.link ?? i.guid ?? '', title: i.title ?? '' }))
        .filter((i) => i.link && i.title);

      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  return [];
}

async function scrapeArticle(newsItemId: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const ogImage =
      dom.window.document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute('content') ?? null;

    const isGoogleImage =
      Boolean(ogImage) &&
      (ogImage!.includes('google.com') ||
        ogImage!.includes('googleapis.com') ||
        ogImage!.includes('googleusercontent.com') ||
        ogImage!.includes('gstatic.com'));

    const ogTitle =
      dom.window.document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content') ?? null;

    const title = article?.title || ogTitle || null;

    const genericTitles = ['google news', 'google'];
    if (title && genericTitles.includes(title.trim().toLowerCase())) {
      await setNewsStatus(newsItemId, 'failed', 'Página genérica do Google — URL inválida');
      return false;
    }

    const summary = buildSummary(article?.excerpt ?? article?.textContent);

    let coverR2Key: string | null = null;
    if (ogImage && !isGoogleImage) {
      coverR2Key = await downloadImageToR2(ogImage, newsItemId);
    }

    await updateNewsItem(newsItemId, {
      ...(title ? { title } : {}),
      summary,
      full_content: article?.textContent?.slice(0, 20_000) ?? null,
      cover_image_url: isGoogleImage ? null : ogImage,
      cover_image_r2_key: coverR2Key,
      scraped_at: new Date().toISOString(),
      status: 'scraped',
      error_message: null,
    });

    return true;
  } catch (err) {
    await setNewsStatus(
      newsItemId,
      'failed',
      `Erro de scrape: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

function buildSummary(text: string | null | undefined): string | null {
  if (!text) return null;
  const chunk = text.replace(/\s+/g, ' ').trim().slice(0, 500);
  const lastPeriod = chunk.lastIndexOf('.');
  return lastPeriod > 80 ? chunk.slice(0, lastPeriod + 1) : chunk;
}

async function downloadImageToR2(imageUrl: string, newsItemId: string): Promise<string | null> {
  try {
    const absoluteUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
    const res = await fetch(absoluteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const key = buildNewsImagePath(new Date(), newsItemId);
    await uploadToR2(key, buffer, {
      contentType,
      cacheControl: 'public, max-age=31536000',
    });
    return key;
  } catch {
    return null;
  }
}
