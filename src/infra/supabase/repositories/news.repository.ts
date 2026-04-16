import { supabase } from '../client';
import type { Database } from '../client';
import type { NewsItem, NewsStatus } from '@/types/domain';

type NewsInsert = Database['public']['Tables']['news_items']['Insert'];
type NewsUpdate = Database['public']['Tables']['news_items']['Update'];

export interface CreateNewsParams {
  title: string;
  sourceUrl: string;
  sourceName: string;
  niche?: string;
  summary?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  coverImageUrl?: string | null;
}

export interface NewsFilters {
  status?: NewsStatus;
  niche?: string;
  sourceName?: string;
  limit?: number;
  offset?: number;
}

export async function createNewsItem(params: CreateNewsParams): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news_items')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      title: params.title,
      source_url: params.sourceUrl,
      source_name: params.sourceName,
      niche: params.niche ?? 'beach-tennis',
      summary: params.summary ?? null,
      author: params.author ?? null,
      published_at: params.publishedAt ?? null,
      cover_image_url: params.coverImageUrl ?? null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as NewsItem;
}

export async function findNewsItemById(id: string): Promise<NewsItem | null> {
  const { data, error } = await supabase
    .from('news_items')
    .select()
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as NewsItem) : null;
}

export async function findNewsItemByUrl(url: string): Promise<NewsItem | null> {
  const { data, error } = await supabase
    .from('news_items')
    .select()
    .eq('source_url', url)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as NewsItem) : null;
}

export async function findNewsItems(
  filters: NewsFilters
): Promise<{ items: NewsItem[]; total: number }> {
  let query = supabase.from('news_items').select('*', { count: 'exact' });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.niche) query = query.eq('niche', filters.niche);
  if (filters.sourceName) query = query.eq('source_name', filters.sourceName);

  query = query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(
      filters.offset ?? 0,
      (filters.offset ?? 0) + (filters.limit ?? 20) - 1
    );

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []) as NewsItem[], total: count ?? 0 };
}

export async function updateNewsItem(
  id: string,
  fields: Partial<NewsUpdate>
): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news_items')
    .update({ ...fields, updated_at: new Date().toISOString() } as NewsUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as NewsItem;
}

export async function setNewsStatus(
  id: string,
  status: NewsStatus,
  errorMessage?: string
): Promise<NewsItem> {
  return updateNewsItem(id, {
    status,
    error_message: errorMessage ?? null,
  });
}

export async function setNewsPublished(id: string): Promise<NewsItem> {
  return updateNewsItem(id, {
    status: 'published',
    published_to_instagram: true,
    published_at_instagram: new Date().toISOString(),
  });
}

/** Retorna todos os itens com o status informado (sem paginação). */
export async function findNewsByStatus(
  status: NewsStatus,
  limit = 100,
  niche?: string
): Promise<NewsItem[]> {
  let query = supabase
    .from('news_items')
    .select()
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (niche) query = query.eq('niche', niche);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NewsItem[];
}

export async function clearNewsItems(niche: string): Promise<number> {
  const { error, count } = await supabase
    .from('news_items')
    .delete({ count: 'exact' })
    .eq('niche', niche);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Retorna itens com status 'story_composed' criados hoje no fuso de Brasília (UTC-3).
 * "Hoje BRT" = created_at >= início do dia atual em UTC-3.
 */
export async function findTodayStoryComposed(niche?: string): Promise<NewsItem[]> {
  // Início do dia corrente em BRT convertido para UTC
  const now = new Date();
  const brtOffsetMs = -3 * 60 * 60 * 1000;
  const nowBRT = new Date(now.getTime() + brtOffsetMs);
  const startOfDayBRT = new Date(nowBRT);
  startOfDayBRT.setUTCHours(0, 0, 0, 0);
  const startOfDayUTC = new Date(startOfDayBRT.getTime() - brtOffsetMs);

  let query = supabase
    .from('news_items')
    .select()
    .eq('status', 'story_composed')
    .gte('created_at', startOfDayUTC.toISOString())
    .order('created_at', { ascending: true });

  if (niche) query = query.eq('niche', niche);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NewsItem[];
}
