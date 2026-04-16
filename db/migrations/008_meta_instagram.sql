-- Migration 008: suporte a Meta Graph API por nicho
alter table niche_settings
  add column if not exists meta_access_token text,
  add column if not exists meta_instagram_account_id text;
