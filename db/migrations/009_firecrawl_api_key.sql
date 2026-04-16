-- Migration 009: adicionar firecrawl_api_key em niche_settings
-- Permite configurar a chave do Firecrawl por nicho via painel admin

alter table niche_settings
  add column if not exists firecrawl_api_key text;

-- Seed: preencher chave já conhecida para beach-tennis
update niche_settings
set firecrawl_api_key = 'fc-bbf305d066014d619b67a3ff991ad429'
where niche_id = 'beach-tennis';
