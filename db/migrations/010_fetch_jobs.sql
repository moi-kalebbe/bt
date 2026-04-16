-- Migration 010: tabela de jobs de fetch para execução em background
CREATE TABLE IF NOT EXISTS fetch_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche        text NOT NULL,
  status       text NOT NULL DEFAULT 'running', -- running | completed | failed
  discovered   int  NOT NULL DEFAULT 0,
  duplicates   int  NOT NULL DEFAULT 0,
  scraped      int  NOT NULL DEFAULT 0,
  failed       int  NOT NULL DEFAULT 0,
  errors       jsonb NOT NULL DEFAULT '[]',
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fetch_jobs_niche_created ON fetch_jobs(niche, created_at DESC);
