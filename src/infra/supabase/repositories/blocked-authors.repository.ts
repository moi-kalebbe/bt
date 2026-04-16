import { supabase } from '../client';
import type { BlockedAuthor, ContentSource } from '@/types/domain';
import type { Database } from '../client';

type BlockedAuthorRow = Database['public']['Tables']['blocked_authors']['Row'];

export interface CreateBlockedAuthorParams {
  source: ContentSource;
  username: string;
  reason?: string;
  niche: string;
}

export async function createBlockedAuthor(
  params: CreateBlockedAuthorParams
): Promise<BlockedAuthor> {
  const { data, error } = await supabase
    .from('blocked_authors')
    .insert({
      source: params.source,
      username: params.username.toLowerCase().trim(),
      reason: params.reason,
      niche: params.niche,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BlockedAuthor;
}

export async function findBlockedAuthors(
  source?: ContentSource,
  niche?: string
): Promise<BlockedAuthor[]> {
  let query = supabase.from('blocked_authors').select().eq('active', true);

  if (source) query = query.eq('source', source);
  if (niche)  query = query.eq('niche', niche);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BlockedAuthor[];
}

export async function isBlocked(
  source: ContentSource,
  username: string,
  niche?: string
): Promise<boolean> {
  const normalizedUsername = username.toLowerCase().replace('@', '').trim();

  let query = supabase
    .from('blocked_authors')
    .select('id')
    .eq('source', source)
    .eq('username', normalizedUsername)
    .eq('active', true);

  if (niche) query = query.eq('niche', niche);

  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') throw error;
  return data !== null;
}

export async function deleteBlockedAuthor(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('blocked_authors')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}
