-- Adiciona coluna niche nas tabelas principais para suporte a múltiplos nichos
-- Executar no Supabase SQL Editor

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'beach-tennis';

CREATE INDEX IF NOT EXISTS idx_content_items_niche ON content_items(niche);

ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'beach-tennis';

CREATE INDEX IF NOT EXISTS idx_news_items_niche ON news_items(niche);
