-- Migration 003: Beach Tennis news pipeline
-- Run in Supabase SQL Editor

create table if not exists news_items (
  id                       uuid        primary key default gen_random_uuid(),
  title                    text        not null,
  summary                  text,
  full_content             text,
  source_url               text        not null unique,
  source_name              text        not null,
  author                   text,
  published_at             timestamptz,
  scraped_at               timestamptz,
  cover_image_url          text,
  cover_image_r2_key       text,
  story_art_r2_key         text,
  status                   text        not null default 'discovered',
  -- status: 'discovered' | 'scraped' | 'story_composed' | 'published' | 'failed'
  published_to_instagram   boolean     not null default false,
  published_at_instagram   timestamptz,
  error_message            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_news_items_status       on news_items(status);
create index if not exists idx_news_items_published_at on news_items(published_at desc);
create index if not exists idx_news_items_created_at   on news_items(created_at desc);
create index if not exists idx_news_items_source_name  on news_items(source_name);
