import { supabase } from '../client';
import type { ViralTrack } from '@/types/domain';

export async function createViralTrack(data: {
  title: string;
  artist: string | null;
  sourceUrl: string | null;
  r2Key: string | null;
}): Promise<ViralTrack> {
  const { data: track, error } = await supabase
    .from('viral_tracks')
    .insert({
      title: data.title,
      artist: data.artist,
      source_url: data.sourceUrl,
      r2_key: data.r2Key,
      active: true,
      gain_db: -24,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create viral track: ${error.message}`);
  }

  return track;
}

export async function findTrackBySourceUrl(sourceUrl: string): Promise<ViralTrack | null> {
  const { data, error } = await supabase
    .from('viral_tracks')
    .select('*')
    .eq('source_url', sourceUrl)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find track by url: ${error.message}`);
  }

  return data;
}

export async function getRandomActiveTrack(): Promise<ViralTrack | null> {
  // Busca todos os ativos primeiro. Para pequenas quantidades (< 1000) é eficiente.
  const { data, error } = await supabase
    .from('viral_tracks')
    .select('*')
    .eq('active', true);

  if (error) {
    throw new Error(`Failed to fetch active tracks: ${error.message}`);
  }

  if (!data || data.length === 0) return null;

  // Sorteia localmente
  const randomIndex = Math.floor(Math.random() * data.length);
  return data[randomIndex];
}

export async function getTracks(limit: number = 50): Promise<ViralTrack[]> {
  const { data, error } = await supabase
    .from('viral_tracks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch tracks: ${error.message}`);
  }

  return data ?? [];
}
