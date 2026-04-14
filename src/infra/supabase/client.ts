import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — only instantiated at runtime (not during Next.js build)
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

// Backwards-compatible named export (used by existing code)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = {
  public: {
    Tables: {
      video_sources: {
        Row: {
          id: string;
          code: string;
          name: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          active?: boolean;
          created_at?: string;
        };
      };
      blocked_authors: {
        Row: {
          id: string;
          source: string;
          username: string;
          reason: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          username: string;
          reason?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: string;
          username?: string;
          reason?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };
      content_items: {
        Row: {
          id: string;
          source: string;
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
          status: string;
          published_to_instagram: boolean;
          published_to_facebook: boolean;
          published_at_instagram: string | null;
          published_at_facebook: string | null;
          selected_for_slot: 'morning' | 'midday' | 'evening' | 'night' | null;
          raw_payload: unknown;
          content_hash: string | null;
          processing_error: string | null;
          retries: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          source_video_id: string;
          source_url: string;
          author_username?: string | null;
          author_display_name?: string | null;
          title?: string | null;
          description?: string | null;
          hashtags?: string[];
          published_at_source?: string | null;
          thumbnail_original_url?: string | null;
          thumbnail_r2_key?: string | null;
          original_video_r2_key?: string | null;
          processed_video_r2_key?: string | null;
          duration_seconds?: number | null;
          status?: string;
          published_to_instagram?: boolean;
          published_to_facebook?: boolean;
          published_at_instagram?: string | null;
          published_at_facebook?: string | null;
          selected_for_slot?: 'morning' | 'midday' | 'evening' | 'night' | null;
          raw_payload?: unknown;
          content_hash?: string | null;
          processing_error?: string | null;
          retries?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: string;
          source_video_id?: string;
          source_url?: string;
          author_username?: string | null;
          author_display_name?: string | null;
          title?: string | null;
          description?: string | null;
          hashtags?: string[];
          published_at_source?: string | null;
          thumbnail_original_url?: string | null;
          thumbnail_r2_key?: string | null;
          original_video_r2_key?: string | null;
          processed_video_r2_key?: string | null;
          duration_seconds?: number | null;
          status?: string;
          published_to_instagram?: boolean;
          published_to_facebook?: boolean;
          published_at_instagram?: string | null;
          published_at_facebook?: string | null;
          selected_for_slot?: 'morning' | 'midday' | 'evening' | 'night' | null;
          raw_payload?: unknown;
          content_hash?: string | null;
          processing_error?: string | null;
          retries?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      publish_targets: {
        Row: {
          id: string;
          platform: string;
          account_name: string;
          account_identifier: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: string;
          account_name: string;
          account_identifier: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: string;
          account_name?: string;
          account_identifier?: string;
          active?: boolean;
          created_at?: string;
        };
      };
      publish_jobs: {
        Row: {
          id: string;
          content_item_id: string;
          target_id: string;
          slot: string | null;
          scheduled_for: string | null;
          status: string;
          response_payload: unknown;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          target_id: string;
          slot?: string | null;
          scheduled_for?: string | null;
          status?: string;
          response_payload?: unknown;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          content_item_id?: string;
          target_id?: string;
          slot?: string | null;
          scheduled_for?: string | null;
          status?: string;
          response_payload?: unknown;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      viral_tracks: {
        Row: {
          id: string;
          title: string;
          artist: string | null;
          source_url: string | null;
          r2_key: string | null;
          active: boolean;
          gain_db: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist?: string | null;
          source_url?: string | null;
          r2_key?: string | null;
          active?: boolean;
          gain_db?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string | null;
          source_url?: string | null;
          r2_key?: string | null;
          active?: boolean;
          gain_db?: number;
          created_at?: string;
        };
      };
      processing_logs: {
        Row: {
          id: string;
          content_item_id: string;
          step: string;
          status: string;
          message: string | null;
          payload: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          step: string;
          status: string;
          message?: string | null;
          payload?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          content_item_id?: string;
          step?: string;
          status?: string;
          message?: string | null;
          payload?: unknown;
          created_at?: string;
        };
      };
    };
  };
};
