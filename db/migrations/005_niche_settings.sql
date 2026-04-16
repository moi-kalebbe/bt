-- Configurações operacionais por nicho — editáveis via UI de settings
-- Separa o que muda por deployment (IDs de conta, handles) do que é config estática (hashtags, keywords)
CREATE TABLE IF NOT EXISTS niche_settings (
  niche_id              text PRIMARY KEY,          -- ex: 'beach-tennis', 'ai-tech'
  -- Zernio account IDs por plataforma
  zernio_instagram_id   text,
  zernio_tiktok_id      text,
  zernio_youtube_id     text,
  zernio_facebook_id    text,
  -- Caption config
  caption_account_handle text,                     -- ex: '@dicas.beachtennis'
  caption_account_tag    text,                     -- ex: '#dicasbeachtennis'
  -- Timestamp
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Seed com valores do nicho beach-tennis (já conhecidos)
INSERT INTO niche_settings (niche_id, zernio_instagram_id, zernio_tiktok_id, zernio_youtube_id, caption_account_handle, caption_account_tag)
VALUES (
  'beach-tennis',
  '69dd27347dea335c2be735df',
  '69dd28a87dea335c2be7480e',
  '69dd28f97dea335c2be74bbb',
  '@dicas.beachtennis',
  '#dicasbeachtennis'
)
ON CONFLICT (niche_id) DO NOTHING;

-- Seed com placeholder para ai-tech (preencher via UI)
INSERT INTO niche_settings (niche_id, caption_account_handle, caption_account_tag)
VALUES ('ai-tech', '@ia.automacao', '#iaautomacao')
ON CONFLICT (niche_id) DO NOTHING;
