import type { ContentItem } from '@/types/domain';

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';

/**
 * Returns permanent R2 URLs for thumbnail and video.
 * External TikTok/YouTube CDN URLs expire quickly, so we skip them
 * and rely on R2-stored files which are permanent.
 * Scheduled videos are guaranteed to have processed_video_r2_key.
 */
export function getMediaUrls(content: ContentItem): {
  thumbnailUrl: string | null;
  videoUrl: string | null;
} {
  // Thumbnail: R2 only (permanent). External URLs from TikTok/YT expire.
  const thumbnailUrl = content.thumbnail_r2_key ? `${R2}/${content.thumbnail_r2_key}` : null;

  // Video: processed R2 first (guaranteed for scheduled), then original R2
  const videoUrl = content.processed_video_r2_key
    ? `${R2}/${content.processed_video_r2_key}`
    : content.original_video_r2_key
    ? `${R2}/${content.original_video_r2_key}`
    : null;

  return { thumbnailUrl, videoUrl };
}
