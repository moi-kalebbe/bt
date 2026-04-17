import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { fetchPostInsights } from '@/infra/meta/instagram.client';
import { getNicheSettings } from '@/infra/supabase/repositories/niche-settings.repository';
import {
  findPublishedWithoutMetrics,
  savePostMetrics,
} from '@/infra/supabase/repositories/instagram-metrics.repository';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseBody(request);
  const niche: string = body.niche ?? 'beach-tennis';

  const settings = await getNicheSettings(niche);
  if (!settings?.meta_access_token || !settings?.meta_instagram_account_id) {
    return NextResponse.json({
      error: 'Meta credentials not configured for this niche',
      niche,
    }, { status: 422 });
  }

  const accessToken = settings.meta_access_token as string;

  const pending = await findPublishedWithoutMetrics(niche, 24);

  if (pending.length === 0) {
    return NextResponse.json({ niche, collected: 0, message: 'Nenhum post pendente de coleta' });
  }

  const results: Array<{ contentItemId: string; postId: string; success: boolean; error?: string }> = [];

  for (const post of pending) {
    const insights = await fetchPostInsights(post.instagram_post_id, accessToken);

    if (!insights.success) {
      results.push({ contentItemId: post.content_item_id, postId: post.instagram_post_id, success: false, error: insights.error });
      continue;
    }

    try {
      await savePostMetrics({
        contentItemId:   post.content_item_id,
        instagramPostId: post.instagram_post_id,
        niche:           post.niche,
        reach:           insights.reach,
        impressions:     insights.impressions,
        likes:           insights.likes,
        comments:        insights.comments,
        shares:          insights.shares,
        saves:           insights.saves,
        videoViews:      insights.videoViews,
        plays:           insights.plays,
        publishedAt:     post.published_at,
      });
      results.push({ contentItemId: post.content_item_id, postId: post.instagram_post_id, success: true });
    } catch (err) {
      results.push({
        contentItemId: post.content_item_id,
        postId: post.instagram_post_id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;

  return NextResponse.json({
    niche,
    pending: pending.length,
    collected: succeeded,
    failed: results.length - succeeded,
    results,
  });
}
