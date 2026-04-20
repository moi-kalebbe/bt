ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS instagram_media_id text;

CREATE INDEX IF NOT EXISTS content_items_instagram_media_id_idx
  ON content_items(instagram_media_id)
  WHERE instagram_media_id IS NOT NULL;

COMMENT ON COLUMN content_items.instagram_media_id IS
  'Meta IG Media ID usado para coletar Instagram Insights.';
