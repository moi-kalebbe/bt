-- Métricas reais coletadas do Instagram Insights API (pós-publicação)
CREATE TABLE IF NOT EXISTS instagram_post_metrics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id   uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  instagram_post_id text NOT NULL,
  niche             text NOT NULL,
  reach             integer,
  impressions       integer,
  likes             integer,
  comments          integer,
  shares            integer,
  saves             integer,
  video_views       integer,
  plays             integer,
  -- (likes + comments + shares + saves) / reach, calculado na inserção
  engagement_rate   numeric(6,4),
  published_at      timestamptz,
  collected_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_post_metrics_content_item_id_idx
  ON instagram_post_metrics(content_item_id);

CREATE INDEX IF NOT EXISTS instagram_post_metrics_niche_collected_at_idx
  ON instagram_post_metrics(niche, collected_at DESC);
