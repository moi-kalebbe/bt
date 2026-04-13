import { supabase } from '../client';
import type { BlockedAuthor, ContentSource } from '@/types/domain';
import type { Database } from '../client';

type BlockedAuthorRow = Database['public']['Tables']['blocked_authors']['Row'];

export interface CreateBlockedAuthorParams {
  source: ContentSource;
  username: string;
  reason?: string;
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
    })
    .select()
    .single();

  if (error) throw error;
  return data as BlockedAuthor;
}

export async function findBlockedAuthors(
  source?: ContentSource
): Promise<BlockedAuthor[]> {
  let query = supabase.from('blocked_authors').select().eq('active', true);

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BlockedAuthor[];
}

export async function isBlocked(
  source: ContentSource,
  username: string
): Promise<boolean> {
  const normalizedUsername = username.toLowerCase().replace('@', '').trim();

  const { data, error } = await supabase
    .from('blocked_authors')
    .select('id')
    .eq('source', source)
    .eq('username', normalizedUsername)
    .eq('active', true)
    .single();

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
