import type { ContentItem, NormalizedContent } from '@/types/domain';
import type { InstagramMetrics } from '@/infra/supabase/repositories/instagram-metrics.repository';

// ── Logarithmic helper ────────────────────────────────────────────────────────
// Returns 0 when n <= 0, otherwise log10(n) * factor capped at max.
// Using log scale prevents one mega-viral video from completely dominating the
// queue — a 10× increase in views yields ~+12 pts, not +10 000 pts.
function logScore(n: number, factor: number, max: number): number {
  if (n <= 0) return 0;
  return Math.min(max, Math.floor(Math.log10(n) * factor));
}

// ── Score breakdown (for reference) ──────────────────────────────────────────
// Metadata signals:   up to  25 pts
// playCount:          up to  50 pts  (100K plays → ~50)
// diggCount (likes):  up to  20 pts  (10K likes  → ~20)
// shareCount:         up to  15 pts  (1K shares  → ~15)
// collectCount(saves):up to  10 pts
// commentCount:       up to   8 pts
// author fans:        up to  10 pts
// verified author:         +  5 pts
// Total possible:    ~143 pts

export interface ScoreBreakdown {
  total: number;
  metadata: number;
  plays: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  authorAuthority: number;
}

export function scoreContent(item: NormalizedContent): number {
  return scoreContentDetailed(item).total;
}

export function scoreContentItem(item: ContentItem): ScoreBreakdown {
  return scoreContentDetailed({
    source: item.source,
    sourceVideoId: item.source_video_id,
    sourceUrl: item.source_url,
    authorUsername: item.author_username,
    authorDisplayName: item.author_display_name,
    title: item.title,
    description: item.description,
    hashtags: item.hashtags,
    publishedAtSource: item.published_at_source,
    thumbnailUrl: item.thumbnail_original_url,
    durationSeconds: item.duration_seconds,
    rawPayload: item.raw_payload,
  });
}

export function scoreContentDetailed(item: NormalizedContent): ScoreBreakdown {
  // ── Metadata signals ───────────────────────────────────────────────────────
  let metadata = 0;
  if ((item.hashtags?.length ?? 0) >= 3)                  metadata += 10;
  if (item.durationSeconds && item.durationSeconds <= 60) metadata += 8;
  if (item.title && item.title.trim().length > 10)        metadata += 5;
  if (item.authorUsername)                                metadata += 2;

  // ── Viral engagement from raw_payload ─────────────────────────────────────
  const raw = item.rawPayload as Record<string, unknown> | null;

  if (!raw) {
    return { total: metadata, metadata, plays: 0, likes: 0, shares: 0, saves: 0, comments: 0, authorAuthority: 0 };
  }

  // TikTok fields: playCount / diggCount / shareCount / collectCount / commentCount
  // YouTube fields: viewCount / likeCount / commentCount
  const plays    = Number(raw.playCount  ?? raw.viewCount  ?? 0);
  const likes    = Number(raw.diggCount  ?? raw.likeCount  ?? 0);
  const shares   = Number(raw.shareCount ?? 0);
  const saves    = Number(raw.collectCount ?? 0);
  const comments = Number(raw.commentCount ?? 0);

  const playsScore    = logScore(plays,    12, 50);
  const likesScore    = logScore(likes,     8, 20);
  const sharesScore   = logScore(shares,    7, 15);
  const savesScore    = logScore(saves,     6, 10);
  const commentsScore = logScore(comments,  4,  8);

  // ── Author authority ───────────────────────────────────────────────────────
  // TikTok: authorMeta.fans / authorMeta.verified
  // YouTube: channelSubscriberCount / isVerified
  const authorMeta = raw.authorMeta as Record<string, unknown> | undefined;
  const fans = Number(
    authorMeta?.fans ?? raw.channelSubscriberCount ?? 0
  );
  const verified = Boolean(
    authorMeta?.verified ?? raw.isVerified ?? false
  );

  let authorAuthority = logScore(fans, 3, 10);
  if (verified) authorAuthority += 5;

  const total =
    metadata +
    playsScore +
    likesScore +
    sharesScore +
    savesScore +
    commentsScore +
    authorAuthority;

  return {
    total,
    metadata,
    plays:    playsScore,
    likes:    likesScore,
    shares:   sharesScore,
    saves:    savesScore,
    comments: commentsScore,
    authorAuthority,
  };
}

// ── Instagram real-performance score (0–130 pts) ─────────────────────────────
// Computed from actual Insights data collected after publishing.
// Comparable in magnitude to scoreContentDetailed().total so they can be
// blended linearly: hybrid = 0.4 * source + 0.6 * ig
export function computeIgPerformanceScore(m: InstagramMetrics): number {
  const engagementRate = Number(m.engagement_rate ?? 0);  // e.g. 0.03 = 3%
  const reach  = m.reach  ?? 0;
  const plays  = m.plays  ?? m.video_views ?? 0;
  const saves  = m.saves  ?? 0;
  const shares = m.shares ?? 0;

  // Engagement rate: up to 60 pts (3% → 60, 1% → 20, 5%+ → capped)
  const engScore  = Math.min(60, Math.floor(engagementRate * 2000));
  // Reach: up to 40 pts logarithmic (10k → 40, 1k → 30)
  const reachScore = logScore(reach, 10, 40);
  // Plays: up to 20 pts (100k → 20)
  const playsScore = logScore(plays, 4, 20);
  // Saves bonus: up to 10 pts (saves = strong intent signal)
  const savesBonus = logScore(saves, 5, 10);
  // Shares bonus: up to 5 pts
  const sharesBonus = logScore(shares, 3, 5);

  return engScore + reachScore + playsScore + savesBonus + sharesBonus;
}

// ── Hybrid score for scheduling ──────────────────────────────────────────────
// Blends source-platform score with real Instagram performance.
// Falls back to source score only when no IG data exists yet.
export function hybridScore(sourceScore: number, igPerfScore: number | null): number {
  if (igPerfScore === null || igPerfScore === undefined) return sourceScore;
  return Math.round(0.4 * sourceScore + 0.6 * igPerfScore);
}
