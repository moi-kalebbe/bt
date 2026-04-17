import { supabase } from '../client';
import { computeIgPerformanceScore } from '@/lib/scoring';

export interface InstagramMetrics {
  id: string;
  content_item_id: string;
  instagram_post_id: string;
  niche: string;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  video_views: number | null;
  plays: number | null;
  engagement_rate: number | null;
  published_at: string | null;
  collected_at: string;
}

export interface SaveMetricsParams {
  contentItemId: string;
  instagramPostId: string;
  niche: string;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  videoViews?: number;
  plays?: number;
  publishedAt?: string;
}

export async function savePostMetrics(params: SaveMetricsParams): Promise<void> {
  const engagements = (params.likes ?? 0) + (params.comments ?? 0) + (params.shares ?? 0) + (params.saves ?? 0);
  const engagementRate = params.reach && params.reach > 0
    ? engagements / params.reach
    : null;

  const metricsRow: InstagramMetrics = {
    id:                '',  // gerado pelo DB
    content_item_id:   params.contentItemId,
    instagram_post_id: params.instagramPostId,
    niche:             params.niche,
    reach:             params.reach ?? null,
    impressions:       params.impressions ?? null,
    likes:             params.likes ?? null,
    comments:          params.comments ?? null,
    shares:            params.shares ?? null,
    saves:             params.saves ?? null,
    video_views:       params.videoViews ?? null,
    plays:             params.plays ?? null,
    engagement_rate:   engagementRate,
    published_at:      params.publishedAt ?? null,
    collected_at:      new Date().toISOString(),
  };

  const { error } = await supabase.from('instagram_post_metrics').insert({
    content_item_id:   metricsRow.content_item_id,
    instagram_post_id: metricsRow.instagram_post_id,
    niche:             metricsRow.niche,
    reach:             metricsRow.reach,
    impressions:       metricsRow.impressions,
    likes:             metricsRow.likes,
    comments:          metricsRow.comments,
    shares:            metricsRow.shares,
    saves:             metricsRow.saves,
    video_views:       metricsRow.video_views,
    plays:             metricsRow.plays,
    engagement_rate:   metricsRow.engagement_rate,
    published_at:      metricsRow.published_at,
  });

  if (error) throw error;

  // Persiste o ig_performance_score no content_item para uso no agendamento
  const igPerfScore = computeIgPerformanceScore(metricsRow);
  await supabase
    .from('content_items')
    .update({ instagram_performance_score: igPerfScore } as Record<string, unknown>)
    .eq('id', params.contentItemId);
}

export async function findLatestMetricsByContentId(
  contentItemId: string
): Promise<InstagramMetrics | null> {
  const { data, error } = await supabase
    .from('instagram_post_metrics')
    .select()
    .eq('content_item_id', contentItemId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (data as InstagramMetrics) : null;
}

export async function findMetricsByContentIds(
  contentItemIds: string[]
): Promise<Map<string, InstagramMetrics>> {
  if (contentItemIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('instagram_post_metrics')
    .select()
    .in('content_item_id', contentItemIds)
    .order('collected_at', { ascending: false });

  if (error) throw error;

  // Keep only the latest entry per content_item_id
  const map = new Map<string, InstagramMetrics>();
  for (const row of (data ?? []) as InstagramMetrics[]) {
    if (!map.has(row.content_item_id)) {
      map.set(row.content_item_id, row);
    }
  }
  return map;
}

// ── Dashboard / Intelligence queries ────────────────────────────────────────

export interface DashboardStats {
  totalAnalyzed: number;
  avgEngagementRate: number;
  totalReach: number;
  avgReach: number;
}

export async function getDashboardStats(niche: string): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from('instagram_post_metrics')
    .select('engagement_rate, reach')
    .eq('niche', niche);

  if (error) throw error;
  const rows = (data ?? []) as Array<{ engagement_rate: number | null; reach: number | null }>;
  if (rows.length === 0) return { totalAnalyzed: 0, avgEngagementRate: 0, totalReach: 0, avgReach: 0 };

  const totalAnalyzed = rows.length;
  const withEng  = rows.filter((r) => r.engagement_rate != null);
  const avgEng   = withEng.length ? withEng.reduce((s, r) => s + Number(r.engagement_rate), 0) / withEng.length : 0;
  const totalReach = rows.reduce((s, r) => s + (r.reach ?? 0), 0);

  return {
    totalAnalyzed,
    avgEngagementRate: avgEng,
    totalReach,
    avgReach: Math.round(totalReach / totalAnalyzed),
  };
}

export interface TopPost {
  content_item_id: string;
  instagram_post_id: string;
  reach: number | null;
  plays: number | null;
  likes: number | null;
  saves: number | null;
  shares: number | null;
  engagement_rate: number | null;
  published_at: string | null;
  // joined
  title: string | null;
  author_username: string | null;
  source: string | null;
  duration_seconds: number | null;
  selected_for_slot: string | null;
}

export async function getTopPosts(niche: string, limit = 10): Promise<TopPost[]> {
  const { data, error } = await supabase
    .from('instagram_post_metrics')
    .select(`
      content_item_id, instagram_post_id, reach, plays, likes, saves, shares, engagement_rate, published_at,
      content_items!inner(title, author_username, source, duration_seconds, selected_for_slot)
    `)
    .eq('niche', niche)
    .not('engagement_rate', 'is', null)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const ci = row['content_items'] as Record<string, unknown> | null;
    return {
      content_item_id:   row['content_item_id'] as string,
      instagram_post_id: row['instagram_post_id'] as string,
      reach:             row['reach'] as number | null,
      plays:             row['plays'] as number | null,
      likes:             row['likes'] as number | null,
      saves:             row['saves'] as number | null,
      shares:            row['shares'] as number | null,
      engagement_rate:   row['engagement_rate'] as number | null,
      published_at:      row['published_at'] as string | null,
      title:             ci?.['title'] as string | null,
      author_username:   ci?.['author_username'] as string | null,
      source:            ci?.['source'] as string | null,
      duration_seconds:  ci?.['duration_seconds'] as number | null,
      selected_for_slot: ci?.['selected_for_slot'] as string | null,
    };
  });
}

export interface SlotPerformance {
  slot: string;
  count: number;
  avgEngagementRate: number;
  avgReach: number;
}

export async function getPerformanceBySlot(niche: string): Promise<SlotPerformance[]> {
  const { data, error } = await supabase
    .from('instagram_post_metrics')
    .select(`
      engagement_rate, reach,
      content_items!inner(selected_for_slot)
    `)
    .eq('niche', niche)
    .not('engagement_rate', 'is', null);

  if (error) throw error;

  const grouped: Record<string, { eng: number[]; reach: number[] }> = {};
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const ci = row['content_items'] as Record<string, unknown> | null;
    const slot = (ci?.['selected_for_slot'] as string | null) ?? 'unknown';
    if (!grouped[slot]) grouped[slot] = { eng: [], reach: [] };
    grouped[slot].eng.push(Number(row['engagement_rate']));
    grouped[slot].reach.push(Number(row['reach'] ?? 0));
  }

  const slotOrder = ['morning', 'midday', 'evening', 'night', 'unknown'];
  return slotOrder
    .filter((s) => grouped[s])
    .map((slot) => {
      const g = grouped[slot];
      return {
        slot,
        count: g.eng.length,
        avgEngagementRate: g.eng.reduce((a, b) => a + b, 0) / g.eng.length,
        avgReach: Math.round(g.reach.reduce((a, b) => a + b, 0) / g.reach.length),
      };
    })
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export interface DurationPerformance {
  bucket: string;
  count: number;
  avgEngagementRate: number;
  avgReach: number;
}

export async function getPerformanceByDuration(niche: string): Promise<DurationPerformance[]> {
  const { data, error } = await supabase
    .from('instagram_post_metrics')
    .select(`
      engagement_rate, reach,
      content_items!inner(duration_seconds)
    `)
    .eq('niche', niche)
    .not('engagement_rate', 'is', null);

  if (error) throw error;

  const buckets: Record<string, { eng: number[]; reach: number[]; label: string }> = {
    '0-15':  { eng: [], reach: [], label: '≤15s' },
    '16-30': { eng: [], reach: [], label: '16–30s' },
    '31-60': { eng: [], reach: [], label: '31–60s' },
    '60+':   { eng: [], reach: [], label: '>60s' },
  };

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const ci = row['content_items'] as Record<string, unknown> | null;
    const dur = Number(ci?.['duration_seconds'] ?? 0);
    const key = dur <= 15 ? '0-15' : dur <= 30 ? '16-30' : dur <= 60 ? '31-60' : '60+';
    buckets[key].eng.push(Number(row['engagement_rate']));
    buckets[key].reach.push(Number(row['reach'] ?? 0));
  }

  return Object.entries(buckets)
    .filter(([, v]) => v.eng.length > 0)
    .map(([, v]) => ({
      bucket: v.label,
      count: v.eng.length,
      avgEngagementRate: v.eng.reduce((a, b) => a + b, 0) / v.eng.length,
      avgReach: Math.round(v.reach.reduce((a, b) => a + b, 0) / v.reach.length),
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export interface PublishedJobRow {
  content_item_id: string;
  instagram_post_id: string;
  published_at: string;
  niche: string;
}

/**
 * Retorna posts publicados no Instagram via Meta API que ainda não têm
 * métricas coletadas e foram publicados há pelo menos minHoursAgo horas.
 */
export async function findPublishedWithoutMetrics(
  niche: string,
  minHoursAgo = 24
): Promise<PublishedJobRow[]> {
  const cutoff = new Date(Date.now() - minHoursAgo * 60 * 60 * 1000).toISOString();

  // Busca content_items publicados no Instagram antes do cutoff
  const { data: items, error: itemsError } = await supabase
    .from('content_items')
    .select('id, niche, published_at_instagram')
    .eq('niche', niche)
    .eq('published_to_instagram', true)
    .lte('published_at_instagram', cutoff);

  if (itemsError) throw itemsError;
  if (!items || items.length === 0) return [];

  const itemIds = items.map((i) => i.id as string);

  // Filtra os que ainda não têm métricas
  const { data: existing, error: existingError } = await supabase
    .from('instagram_post_metrics')
    .select('content_item_id')
    .in('content_item_id', itemIds);

  if (existingError) throw existingError;

  const alreadyCollected = new Set((existing ?? []).map((r: { content_item_id: string }) => r.content_item_id));
  const pending = items.filter((i) => !alreadyCollected.has(i.id as string));

  if (pending.length === 0) return [];

  const pendingIds = pending.map((i) => i.id as string);

  // Busca o postId nos publish_jobs (response_payload->postId)
  const { data: jobs, error: jobsError } = await supabase
    .from('publish_jobs')
    .select('content_item_id, response_payload, created_at')
    .in('content_item_id', pendingIds)
    .eq('status', 'completed');

  if (jobsError) throw jobsError;

  // Monta mapa content_item_id → { postId, created_at }
  const jobMap = new Map<string, { postId: string; createdAt: string }>();
  for (const job of (jobs ?? []) as Array<{ content_item_id: string; response_payload: unknown; created_at: string }>) {
    const payload = job.response_payload as Record<string, unknown> | null;
    const postId = payload?.postId as string | undefined;
    if (postId && !jobMap.has(job.content_item_id)) {
      jobMap.set(job.content_item_id, { postId, createdAt: job.created_at });
    }
  }

  return pending
    .filter((i) => jobMap.has(i.id as string))
    .map((i) => ({
      content_item_id:   i.id as string,
      instagram_post_id: jobMap.get(i.id as string)!.postId,
      published_at:      i.published_at_instagram as string,
      niche:             i.niche as string,
    }));
}
