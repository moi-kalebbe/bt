import { supabase } from '../client';
import type { Database } from '../client';

type FetchJobRow = Database['public']['Tables']['fetch_jobs']['Row'];

export type { FetchJobRow };

export async function createFetchJob(niche: string): Promise<FetchJobRow> {
  const { data, error } = await supabase
    .from('fetch_jobs')
    .insert({ niche })
    .select()
    .single();
  if (error) throw error;
  return data as FetchJobRow;
}

export async function updateFetchJob(
  id: string,
  fields: Partial<Database['public']['Tables']['fetch_jobs']['Update']>
): Promise<void> {
  const { error } = await supabase
    .from('fetch_jobs')
    .update(fields)
    .eq('id', id);
  if (error) console.error('[fetch-jobs] update error:', error);
}

export async function getLatestFetchJob(niche: string): Promise<FetchJobRow | null> {
  const { data, error } = await supabase
    .from('fetch_jobs')
    .select()
    .eq('niche', niche)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as FetchJobRow) : null;
}
