-- Migration 004: adiciona status curated/rejected e campo curated_at

ALTER TABLE news_items DROP CONSTRAINT IF EXISTS news_items_status_check;
ALTER TABLE news_items ADD CONSTRAINT news_items_status_check
  CHECK (status IN ('discovered','scraped','curated','rejected','story_composed','published','failed'));

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS curated_at timestamptz;
