-- Migration 006: adicionar apify_token em niche_settings e niche em viral_tracks

-- Token Apify configurável por painel (em vez de env var por nicho)
alter table niche_settings
  add column if not exists apify_token text;

-- Isolamento de músicas virais por nicho
alter table viral_tracks
  add column if not exists niche text not null default 'beach-tennis';

create index if not exists idx_viral_tracks_niche on viral_tracks(niche);
