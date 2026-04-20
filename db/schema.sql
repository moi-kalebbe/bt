create extension if not exists pgcrypto;

create table if not exists video_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists blocked_authors (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  username text not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(source, username)
);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_video_id text not null,
  source_url text not null,
  author_username text,
  author_display_name text,
  title text,
  description text,
  hashtags jsonb not null default '[]'::jsonb,
  published_at_source timestamptz,
  thumbnail_original_url text,
  thumbnail_r2_key text,
  original_video_r2_key text,
  processed_video_r2_key text,
  duration_seconds integer,
  status text not null default 'discovered',
  published_to_instagram boolean not null default false,
  published_to_facebook boolean not null default false,
  published_to_tiktok boolean not null default false,
  published_to_youtube boolean not null default false,
  instagram_media_id text,
  published_at_instagram timestamptz,
  published_at_facebook timestamptz,
  published_at_tiktok timestamptz,
  published_at_youtube timestamptz,
  selected_for_slot text,
  raw_payload jsonb,
  content_hash text,
  processing_error text,
  retries integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_video_id)
);

create index if not exists idx_content_items_status on content_items(status);
create index if not exists idx_content_items_source on content_items(source);
create index if not exists idx_content_items_author on content_items(author_username);
create index if not exists idx_content_items_published_at_source on content_items(published_at_source desc);
create index if not exists idx_content_items_created_at on content_items(created_at desc);
create index if not exists idx_content_items_instagram_media_id on content_items(instagram_media_id) where instagram_media_id is not null;

create table if not exists publish_targets (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  account_name text not null,
  account_identifier text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists publish_jobs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  target_id uuid not null references publish_targets(id) on delete cascade,
  slot text,
  scheduled_for timestamptz,
  status text not null default 'scheduled',
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_publish_jobs_status on publish_jobs(status);
create index if not exists idx_publish_jobs_scheduled_for on publish_jobs(scheduled_for);

create table if not exists viral_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  source_url text,
  r2_key text,
  active boolean not null default true,
  gain_db numeric(5,2) default -24,
  created_at timestamptz not null default now()
);

create table if not exists processing_logs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  step text not null,
  status text not null,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

insert into blocked_authors (source, username, reason)
values
  ('tiktok', 'btrobson', 'blacklist inicial'),
  ('tiktok', 'raphael.bt', 'blacklist inicial'),
  ('youtube', 'btrobson', 'blacklist inicial'),
  ('youtube', 'raphael.bt', 'blacklist inicial')
on conflict (source, username) do nothing;

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
