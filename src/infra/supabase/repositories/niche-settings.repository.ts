import { supabase } from '../client';
import type { Database } from '../client';

type NicheSettingsRow = Database['public']['Tables']['niche_settings']['Row'];
type NicheSettingsInsert = Database['public']['Tables']['niche_settings']['Insert'];

export type { NicheSettingsRow };

export async function getNicheSettings(nicheId: string): Promise<NicheSettingsRow | null> {
  const { data, error } = await supabase
    .from('niche_settings')
    .select()
    .eq('niche_id', nicheId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function getAllNicheSettings(): Promise<NicheSettingsRow[]> {
  const { data, error } = await supabase
    .from('niche_settings')
    .select()
    .order('niche_id');

  if (error) throw error;
  return (data ?? []) as NicheSettingsRow[];
}

export async function upsertNicheSettings(
  nicheId: string,
  settings: Omit<NicheSettingsInsert, 'niche_id' | 'updated_at'>
): Promise<NicheSettingsRow> {
  const { data, error } = await supabase
    .from('niche_settings')
    .upsert({
      niche_id: nicheId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as NicheSettingsRow;
}
