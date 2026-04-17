-- Migration 011: per-niche story art templates (up to 3 slots each)
CREATE TABLE IF NOT EXISTS story_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  niche       text        NOT NULL,
  slot        smallint    NOT NULL CHECK (slot BETWEEN 1 AND 3),
  name        text        NOT NULL DEFAULT 'Template',
  config      jsonb       NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (niche, slot)
);

CREATE INDEX IF NOT EXISTS idx_story_templates_niche  ON story_templates(niche);
CREATE INDEX IF NOT EXISTS idx_story_templates_active ON story_templates(niche, is_active);
