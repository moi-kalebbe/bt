import {
  createNewsItem,
  findNewsItemByUrl,
  updateNewsItem,
} from '@/infra/supabase/repositories/news.repository';
import { uploadToR2 } from '@/infra/r2/client';
import { buildNewsImagePath } from '@/infra/r2/paths';

export interface FetchNewsResult {
  discovered: number;
  duplicates: number;
  scraped: number;
  failed: number;
  errors: string[];
}

interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogImage?: string;
    publishedTime?: string;
    author?: string;
  };
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: FirecrawlSearchResult[];
  error?: string;
}

async function searchFirecrawl(query: string, limit = 8): Promise<FirecrawlSearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return [];

  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) return [];
  const json = (await res.json()) as FirecrawlSearchResponse;
  return json.success && json.data ? json.data : [];
}

async function downloadCoverImage(imageUrl: string, newsItemId: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const r2Key = buildNewsImagePath(new Date(), newsItemId);
    await uploadToR2(r2Key, buffer, { contentType: 'image/jpeg' });
    return r2Key;
  } catch {
    return null;
  }
}

function isGoogleHosted(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.includes('google.com') || hostname.includes('googleapis.com');
  } catch {
    return false;
  }
}

function buildSummary(text: string | null | undefined): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 500) return clean;
  const cut = clean.slice(0, 500);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 400 ? cut.slice(0, lastSpace) : cut) + '…';
}

export async function fetchFirecrawlNews(
  niche: string,
  queries: string[]
): Promise<FetchNewsResult> {
  const result: FetchNewsResult = {
    discovered: 0,
    duplicates: 0,
    scraped: 0,
    failed: 0,
    errors: [],
  };

  for (const query of queries) {
    let items: FirecrawlSearchResult[];
    try {
      items = await searchFirecrawl(query);
    } catch (err) {
      result.errors.push(
        `[Firecrawl] Query "${query}": ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const item of items) {
      if (!item.url || !item.title) continue;

      try {
        const existing = await findNewsItemByUrl(item.url);
        if (existing) { result.duplicates++; continue; }

        const title = item.metadata?.title ?? item.title;
        const summary = buildSummary(item.description ?? item.metadata?.description ?? item.markdown);
        const fullContent = item.markdown ? item.markdown.slice(0, 20_000) : null;
        const coverImageUrl = item.metadata?.ogImage ?? null;
        const publishedAt = item.metadata?.publishedTime ?? null;
        const author = item.metadata?.author ?? null;

        const newsItem = await createNewsItem({
          title,
          sourceUrl: item.url,
          sourceName: 'Firecrawl',
          niche,
          summary,
          author,
          publishedAt,
          coverImageUrl,
        });
        result.discovered++;

        let coverR2Key: string | null = null;
        if (coverImageUrl && !isGoogleHosted(coverImageUrl)) {
          coverR2Key = await downloadCoverImage(coverImageUrl, newsItem.id);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateNewsItem(newsItem.id, {
          status: 'scraped',
          full_content: fullContent,
          scraped_at: new Date().toISOString(),
          ...(coverR2Key ? { cover_image_r2_key: coverR2Key } : {}),
        } as any);

        result.scraped++;
      } catch (err) {
        result.failed++;
        result.errors.push(
          `[Firecrawl] ${item.url}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return result;
}
