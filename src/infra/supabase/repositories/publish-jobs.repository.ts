import { supabase } from '../client';
import type { PublishJob } from '@/types/domain';
import type { Database } from '../client';

type PublishJobRow = Database['public']['Tables']['publish_jobs']['Row'];
type PublishJobInsert = Database['public']['Tables']['publish_jobs']['Insert'];

export interface CreatePublishJobParams {
  contentItemId: string;
  targetId: string;
  slot?: 'morning' | 'night';
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
