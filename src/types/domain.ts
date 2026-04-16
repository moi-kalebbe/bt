export type ContentSource = 'tiktok' | 'youtube';

export type ContentStatus =
  | 'discovered'
  | 'filtered_out'
  | 'downloaded'
  | 'uploaded_r2'
  | 'ready'
  | 'scheduled'
  | 'processing'
  | 'published'
  | 'failed'
  | 'ignored_duplicate';

export type Slot = 'morning' | 'midday' | 'evening' | 'night';

export type ProcessingProfile = 'reels' | 'stories';

export interface NormalizedContent {
  source: ContentSource;
  sourceVideoId: string;
  sourceUrl: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  title: string | null;
  description: string | null;
  hashtags: string[];
  publishedAtSource: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  rawPayload: unknown;
}

export interface ContentItem {
  id: string;
  source: ContentSource;
  source_video_id: string;
  source_url: string;
  author_username: string | null;
  author_display_name: string | null;
  title: string | null;
  description: string | null;
  hashtags: string[];
  published_at_source: string | null;
  thumbnail_original_url: string | null;
  thumbnail_r2_key: string | null;
  original_video_r2_key: string | null;
  processed_video_r2_key: string | null;
  duration_seconds: number | null;
  status: ContentStatus;
  published_to_instagram: boolean;
  published_to_facebook: boolean;
  published_at_instagram: string | null;
  published_at_facebook: string | null;
  selected_for_slot: Slot | null;
  raw_payload: unknown;
  content_hash: string | null;
  processing_error: string | null;
  retries: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  contentItemId: string;
  trackId: string;
  outputProfile: ProcessingProfile;
}

export interface PublishJob {
  contentItemId: string;
  targetId: string;
  scheduledFor: string;
  slot: Slot;
}

export interface BlockedAuthor {
  id: string;
  source: ContentSource;
  username: string;
  reason: string | null;
  active: boolean;
  created_at: string;
}

export interface ViralTrack {
  id: string;
  title: string;
  artist: string | null;
  source_url: string | null;
  r2_key: string | null;
  active: boolean;
  gain_db: number;
  created_at: string;
}

export interface PublishTarget {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube';
  account_name: string;
  account_identifier: string;
  active: boolean;
  created_at: string;
}

export interface ProcessingLog {
  id: string;
  content_item_id: string;
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string | null;
  payload: unknown;
  created_at: string;
}

export type NewsStatus =
  | 'discovered'
  | 'scraped'
  | 'curated'
  | 'rejected'
  | 'story_composed'
  | 'published'
  | 'failed';

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  full_content: string | null;
  source_url: string;
  source_name: string;
  author: string | null;
  published_at: string | null;
  scraped_at: string | null;
  curated_at: string | null;
  cover_image_url: string | null;
  cover_image_r2_key: string | null;
  story_art_r2_key: string | null;
  status: NewsStatus;
  published_to_instagram: boolean;
  published_at_instagram: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
