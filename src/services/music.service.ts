import { scrapeTrendingSounds } from '@/infra/apify/tiktok.scraper';
import { createViralTrack, findTrackBySourceUrl } from '@/infra/supabase/repositories/viral_tracks.repository';
import { uploadToR2 } from '@/infra/r2/client';
import crypto from 'crypto';

export async function syncViralTracks(limit: number = 50) {
  const sounds = await scrapeTrendingSounds('trendingsong', limit);
  let synced = 0;

  for (const sound of sounds) {
    try {
      // Verifica se a música já foi baixada anteriormente
      const existing = await findTrackBySourceUrl(sound.playUrl);
      if (existing) continue;

      console.log(`[music.service] Baixando: ${sound.musicName}`);
      const response = await fetch(sound.playUrl);
      if (!response.ok) {
        console.error(`[music.service] Falha no download status: ${response.status}`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload para R2
      const uuid = crypto.randomUUID();
      const r2Key = `viral_tracks/tiktok/${new Date().getFullYear()}/${new Date().toISOString().slice(5, 7)}/${uuid}.mp3`;
      await uploadToR2(r2Key, buffer, { contentType: 'audio/mpeg' });

      // Salva no banco de dados
      await createViralTrack({
        title: sound.musicName,
        artist: sound.authorName,
        sourceUrl: sound.playUrl,
        r2Key,
      });

      console.log(`[music.service] Áudio Sincronizado e Salvo: ${sound.musicName}`);
      synced++;
    } catch (err) {
      console.error(`[music.service] Erro ao sincronizar a faixa "${sound.musicName}":`, err);
    }
  }

  return { found: sounds.length, newlySynced: synced };
}
