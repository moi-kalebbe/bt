import { supabase } from '../client';
import { computeIgPerformanceScore } from '@/lib/scoring';
import { pickInstagramMediaIdFromPublishJobs } from './content.repository';

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
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  videoViews?: number | null;
  plays?: number | null;
  publishedAt?: string;
}

export async function savePostMetrics(params: SaveMetricsParams): Promise<void> {
  const engagements =
    (params.likes ?? 0) +
    (params.comments ?? 0) +
    (params.shares ?? 0) +
    (params.saves ?? 0);
  const engagementRate = params.reach && params.reach > 0 ? engagements / params.reach : null;

  const metricsRow: InstagramMetrics = {
    id: '',
    content_item_id: params.contentItemId,
    instagram_post_id: params.instagramPostId,
    niche: params.niche,
    reach: params.reach ?? null,
    impressions: params.impressions ?? null,
    likes: params.likes ?? null,
    comments: params.comments ?? null,
    shares: params.shares ?? null,
    saves: params.saves ?? null,
    video_views: params.videoViews ?? null,
    plays: params.plays ?? null,
    engagement_rate: engagementRate,
    published_at: params.publishedAt ?? null,
    collected_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('instagram_post_metrics').insert({
    content_item_id: metricsRow.content_item_id,
    instagram_post_id: metricsRow.instagram_post_id,
    niche: metricsRow.niche,
    reach: metricsRow.reach,
    impressions: metricsRow.impressions,
    likes: metricsRow.likes,
    comments: metricsRow.comments,
    shares: metricsRow.shares,
    saves: metricsRow.saves,
    video_views: metricsRow.video_views,
    plays: metricsRow.plays,
    engagement_rate: metricsRow.engagement_rate,
    published_at: metricsRow.published_at,
  });

  if (error) throw error;

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

  const map = new Map<string, InstagramMetrics>();
  for (const row of (data ?? []) as InstagramMetrics[]) {
    if (!map.has(row.content_item_id)) {
      map.set(row.content_item_id, row);
    }
  }
  return map;
}

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
  if (rows.length === 0) {
    return { totalAnalyzed: 0, avgEngagementRate: 0, totalReach: 0, avgReach: 0 };
  }

  const totalAnalyzed = rows.length;
  const withEng = rows.filter((row) => row.engagement_rate != null);
  const avgEng = withEng.length
    ? withEng.reduce((sum, row) => sum + Number(row.engagement_rate), 0) / withEng.length
    : 0;
  const totalReach = rows.reduce((sum, row) => sum + (row.reach ?? 0), 0);

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
    const content = row['content_items'] as Record<string, unknown> | null;
    return {
      content_item_id: row['content_item_id'] as string,
      instagram_post_id: row['instagram_post_id'] as string,
      reach: row['reach'] as number | null,
      plays: row['plays'] as number | null,
      likes: row['likes'] as number | null,
      saves: row['saves'] as number | null,
      shares: row['shares'] as number | null,
      engagement_rate: row['engagement_rate'] as number | null,
      published_at: row['published_at'] as string | null,
      title: content?.['title'] as string | null,
      author_username: content?.['author_username'] as string | null,
      source: content?.['source'] as string | null,
      duration_seconds: content?.['duration_seconds'] as number | null,
      selected_for_slot: content?.['selected_for_slot'] as string | null,
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
    const content = row['content_items'] as Record<string, unknown> | null;
    const slot = (content?.['selected_for_slot'] as string | null) ?? 'unknown';
    if (!grouped[slot]) grouped[slot] = { eng: [], reach: [] };
    grouped[slot].eng.push(Number(row['engagement_rate']));
    grouped[slot].reach.push(Number(row['reach'] ?? 0));
  }

  const slotOrder = ['morning', 'midday', 'evening', 'night', 'unknown'];
  return slotOrder
    .filter((slot) => grouped[slot])
    .map((slot) => {
      const group = grouped[slot];
      return {
        slot,
        count: group.eng.length,
        avgEngagementRate: group.eng.reduce((a, b) => a + b, 0) / group.eng.length,
        avgReach: Math.round(group.reach.reduce((a, b) => a + b, 0) / group.reach.length),
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
    '0-15': { eng: [], reach: [], label: '<=15s' },
    '16-30': { eng: [], reach: [], label: '16-30s' },
    '31-60': { eng: [], reach: [], label: '31-60s' },
    '60+': { eng: [], reach: [], label: '>60s' },
  };

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const content = row['content_items'] as Record<string, unknown> | null;
    const duration = Number(content?.['duration_seconds'] ?? 0);
    const key = duration <= 15 ? '0-15' : duration <= 30 ? '16-30' : duration <= 60 ? '31-60' : '60+';
    buckets[key].eng.push(Number(row['engagement_rate']));
    buckets[key].reach.push(Number(row['reach'] ?? 0));
  }

  return Object.entries(buckets)
    .filter(([, value]) => value.eng.length > 0)
    .map(([, value]) => ({
      bucket: value.label,
      count: value.eng.length,
      avgEngagementRate: value.eng.reduce((a, b) => a + b, 0) / value.eng.length,
      avgReach: Math.round(value.reach.reduce((a, b) => a + b, 0) / value.reach.length),
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export interface PublishedJobRow {
  content_item_id: string;
  instagram_post_id: string;
  published_at: string;
  niche: string;
}

interface InstagramPublishJobRow {
  content_item_id: string;
  response_payload: unknown;
  publish_targets?: {
    platform?: string | null;
  } | null;
}

interface PublishedInstagramContentRow {
  id: string;
  instagram_media_id: string | null;
  niche: string;
  published_at_instagram: string;
}

export async function backfillInstagramMediaIds(niche: string): Promise<{ backfilled: number }> {
  const { data: items, error: itemsError } = await supabase
    .from('content_items')
    .select('id')
    .eq('niche', niche)
    .eq('published_to_instagram', true)
    .is('instagram_media_id', null);

  if (itemsError) throw itemsError;
  if (!items?.length) return { backfilled: 0 };

  const itemIds = items.map((item) => item.id as string);
  const { data: jobs, error: jobsError } = await supabase
    .from('publish_jobs')
    .select('content_item_id, response_payload, publish_targets(platform)')
    .in('content_item_id', itemIds)
    .eq('status', 'completed');

  if (jobsError) throw jobsError;

  const jobsByContentId = new Map<string, InstagramPublishJobRow[]>();
  for (const job of (jobs ?? []) as InstagramPublishJobRow[]) {
    const existing = jobsByContentId.get(job.content_item_id) ?? [];
    existing.push(job);
    jobsByContentId.set(job.content_item_id, existing);
  }

  let backfilled = 0;
  for (const itemId of itemIds) {
    const mediaId = pickInstagramMediaIdFromPublishJobs(
      (jobsByContentId.get(itemId) ?? []).map((job) => ({
        platform: job.publish_targets?.platform ?? null,
        response_payload: job.response_payload,
      }))
    );

    if (!mediaId) continue;

    const { error } = await supabase
      .from('content_items')
      .update({ instagram_media_id: mediaId } as Record<string, unknown>)
      .eq('id', itemId)
      .is('instagram_media_id', null);

    if (error) throw error;
    backfilled++;
  }

  return { backfilled };
}

export async function countPublishedWithoutMetaMediaId(
  niche: string,
  minHoursAgo = 24
): Promise<number> {
  const cutoff = new Date(Date.now() - minHoursAgo * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('content_items')
    .select('*', { count: 'exact', head: true })
    .eq('niche', niche)
    .eq('published_to_instagram', true)
    .lte('published_at_instagram', cutoff)
    .is('instagram_media_id', null);

  if (error) throw error;
  return count ?? 0;
}

export async function findPublishedWithoutMetrics(
  niche: string,
  minHoursAgo = 24
): Promise<PublishedJobRow[]> {
  const cutoff = new Date(Date.now() - minHoursAgo * 60 * 60 * 1000).toISOString();

  const { data: items, error: itemsError } = await supabase
    .from('content_items')
    .select('id, instagram_media_id, niche, published_at_instagram')
    .eq('niche', niche)
    .eq('published_to_instagram', true)
    .lte('published_at_instagram', cutoff)
    .not('instagram_media_id', 'is', null);

  if (itemsError) throw itemsError;
  if (!items?.length) return [];

  const publishedItems = items as PublishedInstagramContentRow[];
  const itemIds = publishedItems.map((item) => item.id);
  const { data: existing, error: existingError } = await supabase
    .from('instagram_post_metrics')
    .select('content_item_id')
    .in('content_item_id', itemIds);

  if (existingError) throw existingError;

  const alreadyCollected = new Set(
    (existing ?? []).map((row: { content_item_id: string }) => row.content_item_id)
  );

  return publishedItems
    .filter((item) => !alreadyCollected.has(item.id))
    .map((item) => ({
      content_item_id: item.id,
      instagram_post_id: item.instagram_media_id as string,
      published_at: item.published_at_instagram,
      niche: item.niche,
    }));
}

// Returns Map<utcHour(0-23), avgEngagementRate> for A/B time selection
export async function getPerformanceByHour(niche: string): Promise<Map<number, number>> {
  const { data } = await supabase
    .from('instagram_post_metrics')
    .select(`
      engagement_rate,
      content_items!inner(published_at_instagram, niche)
    `)
    .eq('niche', niche)
    .not('engagement_rate', 'is', null);

  const byHour = new Map<number, number[]>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const ci = row['content_items'] as Record<string, unknown> | null;
    const publishedAt = ci?.['published_at_instagram'] as string | null;
    if (!publishedAt) continue;
    const hour = new Date(publishedAt).getUTCHours();
    const eng = Number(row['engagement_rate']);
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(eng);
  }

  const result = new Map<number, number>();
  for (const [hour, engs] of byHour) {
    result.set(hour, engs.reduce((a, b) => a + b, 0) / engs.length);
  }
  return result;
}
