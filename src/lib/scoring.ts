import type { NormalizedContent } from '@/types/domain';

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

export function scoreContentDetailed(item: NormalizedContent): ScoreBreakdown {
  // ── Metadata signals ───────────────────────────────────────────────────────
  let metadata = 0;
  if (item.hashtags.length >= 3)                          metadata += 10;
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
