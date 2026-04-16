import { scrapeTrendingSounds } from '@/infra/apify/tiktok.scraper';
import { createViralTrack, findTrackBySourceUrl } from '@/infra/supabase/repositories/viral_tracks.repository';
import { uploadToR2 } from '@/infra/r2/client';
import { getNicheConfig, getApifyToken } from '@/config/niche-configs';
import crypto from 'crypto';

export async function syncViralTracks(niche = 'beach-tennis', limit: number = 50) {
  const config = getNicheConfig(niche);
  const apifyToken = await getApifyToken(niche);

  // Usa a primeira hashtag de música do nicho como seed para o scraper
  const hashtag = config.musicHashtags[0] ?? 'trendingsong';
  const sounds = await scrapeTrendingSounds(hashtag, limit, apifyToken);
  let synced = 0;

  for (const sound of sounds) {
    try {
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

      const uuid = crypto.randomUUID();
      const r2Key = `viral_tracks/${niche}/${new Date().getFullYear()}/${new Date().toISOString().slice(5, 7)}/${uuid}.mp3`;
      await uploadToR2(r2Key, buffer, { contentType: 'audio/mpeg' });

      await createViralTrack({
        title: sound.musicName,
        artist: sound.authorName,
        sourceUrl: sound.playUrl,
        r2Key,
        niche,
      });

      console.log(`[music.service] Áudio Sincronizado e Salvo: ${sound.musicName}`);
      synced++;
    } catch (err) {
      console.error(`[music.service] Erro ao sincronizar a faixa "${sound.musicName}":`, err);
    }
  }

  return { niche, found: sounds.length, newlySynced: synced };
}
