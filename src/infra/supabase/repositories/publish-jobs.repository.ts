import { supabase } from '../client';
import type { PublishJob } from '@/types/domain';
import type { Database } from '../client';

type PublishJobRow = Database['public']['Tables']['publish_jobs']['Row'];
type PublishJobInsert = Database['public']['Tables']['publish_jobs']['Insert'];

export interface CreatePublishJobParams {
  contentItemId: string;
  targetId: string;
  slot?: 'morning' | 'midday' | 'evening' | 'night';
  scheduledFor?: string;
}

export async function createPublishJob(
  params: CreatePublishJobParams
): Promise<PublishJob> {
  const { data, error } = await supabase
    .from('publish_jobs')
    .insert({
      content_item_id: params.contentItemId,
      target_id: params.targetId,
      slot: params.slot ?? null,
      scheduled_for: params.scheduledFor ?? null,
      status: 'scheduled',
    } as PublishJobInsert)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PublishJob;
}

export async function findPublishJobsByContentId(
  contentItemId: string
): Promise<PublishJob[]> {
  const { data, error } = await supabase
    .from('publish_jobs')
    .select()
    .eq('content_item_id', contentItemId);

  if (error) throw error;
  return (data ?? []) as PublishJob[];
}

export async function findScheduledJobs(): Promise<PublishJob[]> {
  const { data, error } = await supabase
    .from('publish_jobs')
    .select()
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString());

  if (error) throw error;
  return (data ?? []) as PublishJob[];
}

export interface WeeklySlot {
  publishJobId: string;
  contentItemId: string;
  slot: string;
  scheduledFor: string;
  title: string | null;
  authorUsername: string | null;
  thumbnailR2Key: string | null;
  processedVideoR2Key: string | null;
  originalVideoR2Key: string | null;
  sourceUrl: string | null;
}

export async function getWeeklySchedule(niche: string, days = 7): Promise<WeeklySlot[]> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const { data, error } = await supabase
    .from('publish_jobs')
    .select(`
      id,
      slot,
      scheduled_for,
      content_item_id,
      content_items!inner (
        id,
        niche,
        title,
        author_username,
        thumbnail_r2_key,
        processed_video_r2_key,
        original_video_r2_key,
        source_url
      )
    `)
    .eq('status', 'scheduled')
    .not('slot', 'is', null)
    .gte('scheduled_for', now.toISOString())
    .lt('scheduled_for', end.toISOString())
    .eq('content_items.niche', niche)
    .order('scheduled_for', { ascending: true });

  if (error) throw error;

  // Deduplicate: multiple publish_jobs exist per item (one per target)
  const seen = new Set<string>();
  const result: WeeklySlot[] = [];
  for (const row of (data ?? []) as any[]) {
    const key = `${row.content_item_id}-${row.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ci = row.content_items;
    result.push({
      publishJobId: row.id,
      contentItemId: row.content_item_id,
      slot: row.slot,
      scheduledFor: row.scheduled_for,
      title: ci?.title ?? null,
      authorUsername: ci?.author_username ?? null,
      thumbnailR2Key: ci?.thumbnail_r2_key ?? null,
      processedVideoR2Key: ci?.processed_video_r2_key ?? null,
      originalVideoR2Key: ci?.original_video_r2_key ?? null,
      sourceUrl: ci?.source_url ?? null,
    });
  }
  return result;
}

export async function updatePublishJobStatus(
  id: string,
  status: string,
  responsePayload?: unknown,
  errorMessage?: string
): Promise<PublishJob> {
  const { data, error } = await supabase
    .from('publish_jobs')
    .update({
      status,
      response_payload: responsePayload ?? null,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PublishJob;
}
