import { supabase } from '../client';
import type { ContentItem, ContentStatus, Slot } from '@/types/domain';
import type { Database } from '../client';

type ContentInsert = Database['public']['Tables']['content_items']['Insert'];
type ContentUpdate = Database['public']['Tables']['content_items']['Update'];

export interface CreateContentParams {
  source: string;
  sourceVideoId: string;
  sourceUrl: string;
  niche?: string;
  authorUsername?: string | null;
  authorDisplayName?: string | null;
  title?: string | null;
  description?: string | null;
  hashtags?: string[];
  publishedAtSource?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  rawPayload?: unknown;
  contentHash?: string;
}

export interface ContentFilters {
  source?: string;
  status?: ContentStatus;
  niche?: string;
  authorUsername?: string;
  selectedForSlot?: Slot | null;
  limit?: number;
  offset?: number;
  sortBy?: 'score' | 'newest' | 'oldest';
}

export async function createContent(
  params: CreateContentParams
): Promise<ContentItem> {
  const insertData = {
    source: params.source,
    source_video_id: params.sourceVideoId,
    source_url: params.sourceUrl,
    niche: params.niche ?? 'beach-tennis',
    author_username: params.authorUsername ?? null,
    author_display_name: params.authorDisplayName ?? null,
    title: params.title ?? null,
    description: params.description ?? null,
    hashtags: params.hashtags ?? [],
    published_at_source: params.publishedAtSource ?? null,
    thumbnail_original_url: params.thumbnailUrl ?? null,
    duration_seconds: params.durationSeconds ?? null,
    raw_payload: params.rawPayload ?? null,
    content_hash: params.contentHash ?? null,
  };

  const { data, error } = await supabase
    .from('content_items')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export async function findContentById(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabase
    .from('content_items')
    .select()
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as ContentItem) : null;
}

export async function findContentBySourceAndVideoId(
  source: string,
  sourceVideoId: string
): Promise<ContentItem | null> {
  const { data, error } = await supabase
    .from('content_items')
    .select()
    .eq('source', source)
    .eq('source_video_id', sourceVideoId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as ContentItem) : null;
}

export async function findContentByHash(
  hash: string
): Promise<ContentItem | null> {
  const { data, error } = await supabase
    .from('content_items')
    .select()
    .eq('content_hash', hash)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as ContentItem) : null;
}

export async function findContents(
  filters: ContentFilters
): Promise<{ items: ContentItem[]; total: number }> {
  let query = supabase.from('content_items').select('*', { count: 'exact' });

  if (filters.source) {
    query = query.eq('source', filters.source);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.niche) {
    query = query.eq('niche', filters.niche);
  }
  if (filters.authorUsername) {
    query = query.eq('author_username', filters.authorUsername);
  }
  if (filters.selectedForSlot !== undefined) {
    if (filters.selectedForSlot === null) {
      query = query.is('selected_for_slot', null);
    } else {
      query = query.eq('selected_for_slot', filters.selectedForSlot);
    }
  }

  // When sorting by score we fetch a large batch and let the caller sort in memory
  const ascending = filters.sortBy === 'oldest';
  const fetchLimit = filters.sortBy === 'score' ? 500 : (filters.limit ?? 20);
  const fetchOffset = filters.sortBy === 'score' ? 0 : (filters.offset ?? 0);

  query = query
    .order('created_at', { ascending })
    .range(fetchOffset, fetchOffset + fetchLimit - 1);

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    items: (data ?? []) as ContentItem[],
    total: count ?? 0,
  };
}

export async function updateContentStatus(
  id: string,
  status: ContentStatus
): Promise<ContentItem> {
  const { data, error } = await supabase
    .from('content_items')
    .update({ status, updated_at: new Date().toISOString() } as ContentUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export async function updateContentR2Keys(
  id: string,
  keys: {
    thumbnailR2Key?: string | null;
    originalVideoR2Key?: string | null;
    processedVideoR2Key?: string | null;
  }
): Promise<ContentItem> {
  const updateData: Partial<ContentUpdate> = {
    updated_at: new Date().toISOString(),
  };

  if (keys.thumbnailR2Key !== undefined) {
    updateData.thumbnail_r2_key = keys.thumbnailR2Key;
  }
  if (keys.originalVideoR2Key !== undefined) {
    updateData.original_video_r2_key = keys.originalVideoR2Key;
  }
  if (keys.processedVideoR2Key !== undefined) {
    updateData.processed_video_r2_key = keys.processedVideoR2Key;
  }

  const { data, error } = await supabase
    .from('content_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export async function setContentScheduled(
  id: string,
  slot: Slot
): Promise<ContentItem> {
  const { data, error } = await supabase
    .from('content_items')
    .update({
      status: 'scheduled',
      selected_for_slot: slot,
      updated_at: new Date().toISOString(),
    } as ContentUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export async function setContentPublished(
  id: string,
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube'
): Promise<ContentItem> {
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status: 'published',
    updated_at: now,
  };

  if (platform === 'instagram') {
    updateData.published_to_instagram = true;
    updateData.published_at_instagram = now;
  } else if (platform === 'facebook') {
    updateData.published_to_facebook = true;
    updateData.published_at_facebook = now;
  } else if (platform === 'tiktok') {
    updateData.published_to_tiktok = true;
    updateData.published_at_tiktok = now;
  } else if (platform === 'youtube') {
    updateData.published_to_youtube = true;
    updateData.published_at_youtube = now;
  }

  const { data, error } = await supabase
    .from('content_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export async function setContentProcessingError(
  id: string,
  processingError: string
): Promise<ContentItem> {
  const { data, error } = await supabase
    .from('content_items')
    .update({
      status: 'failed',
      processing_error: processingError,
      updated_at: new Date().toISOString(),
    } as ContentUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export async function incrementRetries(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_retries', { item_id: id });
  if (error) throw error;
}

export async function unscheduleContent(id: string): Promise<ContentItem> {
  const { data, error } = await supabase
    .from('content_items')
    .update({
      status: 'ready',
      selected_for_slot: null,
      updated_at: new Date().toISOString(),
    } as ContentUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

export interface PipelineStats {
  pipeline: number;
  ready: number;
  scheduled: number;
  publishedToday: number;
}

export async function countByStatus(niche: string): Promise<PipelineStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pipelineRes, readyRes, scheduledRes, publishedRes] = await Promise.all([
    supabase
      .from('content_items')
      .select('*', { count: 'exact', head: true })
      .eq('niche', niche)
      .or('status.eq.discovered,status.eq.downloaded,status.eq.uploaded_r2,status.eq.ready,status.eq.scheduled,status.eq.processing'),
    supabase
      .from('content_items')
      .select('*', { count: 'exact', head: true })
      .eq('niche', niche)
      .eq('status', 'ready'),
    supabase
      .from('content_items')
      .select('*', { count: 'exact', head: true })
      .eq('niche', niche)
      .eq('status', 'scheduled'),
    supabase
      .from('content_items')
      .select('*', { count: 'exact', head: true })
      .eq('niche', niche)
      .eq('published_to_instagram', true)
      .gte('published_at_instagram', todayStart.toISOString()),
  ]);

  return {
    pipeline: pipelineRes.count ?? 0,
    ready: readyRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
    publishedToday: publishedRes.count ?? 0,
  };
}
