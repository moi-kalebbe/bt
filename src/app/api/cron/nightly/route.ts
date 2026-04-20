import { NextRequest, NextResponse } from 'next/server';
import { selectAndScheduleVideos } from '@/services/schedule.service';
import { getNicheSettings } from '@/infra/supabase/repositories/niche-settings.repository';
import { fetchPostInsights } from '@/infra/meta/instagram.client';
import {
  backfillInstagramMediaIds,
  countPublishedWithoutMetaMediaId,
  findPublishedWithoutMetrics,
  savePostMetrics,
} from '@/infra/supabase/repositories/instagram-metrics.repository';

// Niches to process every night. Expand as new niches are added.
const NICHES = ['beach-tennis'];

// Called every night at midnight Brazil time (03:00 UTC) by Vercel Cron.
// Runs for each active niche:
//   1. Schedule next 7 days of content (skips days already scheduled)
//   2. Collect Instagram insights for published posts (>24h old)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  for (const niche of NICHES) {
    const nicheResult: Record<string, unknown> = {};

    // ── 1. Schedule 7 days ───────────────────────────────────────────────────
    try {
      const schedule = await selectAndScheduleVideos(niche, 7);
      nicheResult.schedule = {
        days: schedule.days,
        scheduled: schedule.scheduled.length,
        skipped: schedule.skipped,
      };
    } catch (err) {
      nicheResult.schedule = { error: String(err) };
    }

    // ── 2. Collect Instagram Insights ────────────────────────────────────────
    try {
      const settings = await getNicheSettings(niche);
      if (!settings?.meta_access_token || !settings?.meta_instagram_account_id) {
        nicheResult.insights = { skipped: 'Meta credentials not configured' };
      } else {
        const accessToken = settings.meta_access_token as string;
        const { backfilled } = await backfillInstagramMediaIds(niche);
        const unavailable = await countPublishedWithoutMetaMediaId(niche, 24);
        const pending = await findPublishedWithoutMetrics(niche, 24);

        let collected = 0;
        let failed = 0;

        for (const post of pending) {
          const insights = await fetchPostInsights(post.instagram_post_id, accessToken);
          if (!insights.success) { failed++; continue; }

          await savePostMetrics({
            contentItemId:   post.content_item_id,
            instagramPostId: post.instagram_post_id,
            niche:           post.niche,
            reach:           insights.reach ?? 0,
            impressions:     insights.impressions ?? 0,
            likes:           insights.likes ?? 0,
            comments:        insights.comments ?? 0,
            shares:          insights.shares ?? 0,
            saves:           insights.saves ?? 0,
            videoViews:      insights.videoViews ?? null,
            plays:           insights.plays ?? null,
            publishedAt:     post.published_at,
          });
          collected++;
        }

        nicheResult.insights = { backfilled, unavailable, collected, failed };
      }
    } catch (err) {
      nicheResult.insights = { error: String(err) };
    }

    results[niche] = nicheResult;
  }

  console.log('[cron/nightly]', JSON.stringify(results));
  return NextResponse.json({ success: true, results });
}
