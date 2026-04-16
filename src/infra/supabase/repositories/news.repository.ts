import { supabase } from '../client';
import type { Database } from '../client';
import type { NewsItem, NewsStatus } from '@/types/domain';

type NewsInsert = Database['public']['Tables']['news_items']['Insert'];
type NewsUpdate = Database['public']['Tables']['news_items']['Update'];

export interface CreateNewsParams {
  title: string;
  sourceUrl: string;
  sourceName: string;
  summary?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  coverImageUrl?: string | null;
}

export interface NewsFilters {
  status?: NewsStatus;
  sourceName?: string;
  limit?: number;
  offset?: number;
}

export async function createNewsItem(params: CreateNewsParams): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news_items')
    .insert({
      title: params.title,
      source_url: params.sourceUrl,
      source_name: params.sourceName,
      summary: params.summary ?? null,
      author: params.author ?? null,
      published_at: params.publishedAt ?? null,
      cover_image_url: params.coverImageUrl ?? null,
    } as NewsInsert)
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
