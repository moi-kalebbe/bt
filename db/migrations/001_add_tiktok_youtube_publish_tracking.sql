-- Migration 001: Add TikTok and YouTube publish tracking to content_items
-- Run this in the Supabase SQL Editor

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS published_to_tiktok  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at_tiktok  timestamptz,
  ADD COLUMN IF NOT EXISTS published_to_youtube boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at_youtube timestamptz;
