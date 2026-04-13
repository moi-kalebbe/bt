import type { NormalizedContent } from '@/types/domain';

export function scoreContent(item: NormalizedContent): number {
  let score = 0;

  if (item.hashtags.length >= 3) score += 10;
  if (item.durationSeconds && item.durationSeconds <= 60) score += 8;
  if (item.title && item.title.trim().length > 10) score += 5;
  if (item.authorUsername) score += 2;

  return score;
}
