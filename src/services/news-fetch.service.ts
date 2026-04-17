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
import { fetchFirecrawlNews, type FetchNewsResult } from './news-firecrawl.service';

export type { FetchNewsResult };

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentBot/1.0)' },
});

const MAX_ITEMS_PER_SOURCE = 8;   // evita RSS com dezenas de itens travando o job
const FETCH_BUDGET_MS = 8 * 60 * 1000; // 8 min — job para de processar novos itens após isso

export async function fetchNicheNews(niche = 'beach-tennis'): Promise<FetchNewsResult> {
  const config = getNicheConfig(niche);
  const deadline = Date.now() + FETCH_BUDGET_MS;

  const result: FetchNewsResult = {
    discovered: 0,
    duplicates: 0,
    scraped: 0,
    failed: 0,
    errors: [],
  };

  for (const source of config.newsSources) {
    if (Date.now() > deadline) {
      result.errors.push('[fetch] Budget de tempo atingido — fontes restantes ignoradas');
      break;
    }

    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      result.errors.push(
        `[${source.name}] RSS fetch error: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const item of (feed.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE)) {
      if (Date.now() > deadline) break;
      try {
        // Filtro por palavra-chave — insensível a maiúsculas E acentos
        if (source.filterKeyword) {
          const normalize = (s: string) =>
            s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const kw = normalize(source.filterKeyword);
          if (!normalize(item.title ?? '').includes(kw) &&
              !normalize(item.contentSnippet ?? item.summary ?? '').includes(kw)) continue;
        }

        const rawTitle = item.title ?? '';
        const cleanTitle = source.needsResolution
          ? rawTitle.replace(/\s*[-–]\s*[\w.]+\.(com|br|net|org|io)\s*$/, '').trim() || rawTitle
          : rawTitle;

        let resolvedUrl: string | null = null;

        if (source.needsResolution) {
          const googleNewsLink = item.link ?? '';
          if (!googleNewsLink) { result.failed++; continue; }

          // Usa Jina Reader: segue redirect do Google News E extrai conteúdo em uma chamada
          const jinaData = await scrapeViaJina(googleNewsLink);
          if (!jinaData) { result.failed++; continue; }

          const existingJina = await findNewsItemByUrl(jinaData.url);
          if (existingJina) { result.duplicates++; continue; }

          const newsItem = await createNewsItem({
            title: jinaData.title || cleanTitle || rawTitle,
            sourceUrl: jinaData.url,
            sourceName: source.name,
            niche,
            summary: buildSummary(jinaData.content),
            author: item.creator ?? null,
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          });
          result.discovered++;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateNewsItem(newsItem.id, {
            status: 'scraped',
            full_content: jinaData.content?.slice(0, 20_000) ?? null,
            scraped_at: new Date().toISOString(),
          } as any);
          result.scraped++;
          continue;
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

  // Firecrawl: busca complementar em portais regionais e nacionais não cobertos pelo RSS
  if (config.firecrawlQueries?.length) {
    const fcResult = await fetchFirecrawlNews(niche, config.firecrawlQueries);
    result.discovered += fcResult.discovered;
    result.duplicates += fcResult.duplicates;
    result.scraped    += fcResult.scraped;
    result.failed     += fcResult.failed;
    result.errors.push(...fcResult.errors);
  }

  return result;
}

/** @deprecated Use fetchNicheNews('beach-tennis') */
export async function fetchBeachTennisNews(): Promise<FetchNewsResult> {
  return fetchNicheNews('beach-tennis');
}

interface JinaResult {
  url: string;
  title: string;
  content: string | null;
}

async function scrapeViaJina(url: string): Promise<JinaResult | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: 'application/json',
        'X-Return-Format': 'markdown',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;

    const json = await res.json() as {
      code?: number;
      data?: { url?: string; title?: string; content?: string; description?: string };
    };

    const data = json.data;
    if (!data?.url || isGoogleOrigin(data.url)) return null;

    return {
      url: data.url,
      title: data.title ?? '',
      content: data.content ?? data.description ?? null,
    };
  } catch {
    return null;
  }
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

    // Jina Reader fallback: quando Readability não extrai conteúdo suficiente
    let jinaContent: string | null = null;
    if (!article?.textContent || article.textContent.trim().length < 100) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
          headers: { Accept: 'text/plain', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(15_000),
        });
        if (jinaRes.ok) {
          jinaContent = (await jinaRes.text()).slice(0, 20_000) || null;
        }
      } catch { /* Jina indisponível, continua sem fallback */ }
    }

    const genericTitles = ['google news', 'google'];
    if (title && genericTitles.includes(title.trim().toLowerCase())) {
      await setNewsStatus(newsItemId, 'failed', 'Página genérica do Google — URL inválida');
      return false;
    }

    const fullContent = article?.textContent?.slice(0, 20_000) ?? jinaContent;
    const summary = buildSummary(article?.excerpt ?? article?.textContent ?? jinaContent);

    let coverR2Key: string | null = null;
    if (ogImage && !isGoogleImage) {
      coverR2Key = await downloadImageToR2(ogImage, newsItemId);
    }

    await updateNewsItem(newsItemId, {
      ...(title ? { title } : {}),
      summary,
      full_content: fullContent,
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
