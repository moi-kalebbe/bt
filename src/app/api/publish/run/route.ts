import { NextRequest, NextResponse } from 'next/server';
import { findScheduledJobs, updatePublishJobStatus } from '@/infra/supabase/repositories/publish-jobs.repository';
import { publishVideo } from '@/services/publish.service';
import { supabase } from '@/infra/supabase/client';
import type { ZernioPlatform } from '@/infra/zernio/client';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const fromAdminUI = request.headers.get('x-admin-ui') === '1';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && !fromAdminUI && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobs = await findScheduledJobs();

  if (jobs.length === 0) {
    return NextResponse.json({ ran: 0, results: [] });
  }

  // Track which platforms already hit their daily limit so we skip remaining
  // jobs for that platform without making unnecessary API calls.
  const dailyLimitPlatforms = new Set<string>();

  const results: Array<Record<string, unknown>> = [];

  for (const job of jobs) {
    const j = job as unknown as {
      id: string;
      content_item_id: string;
      target_id: string;
    };

    // Resolve platform from publish_target
    const { data: target } = await supabase
      .from('publish_targets')
      .select('platform')
      .eq('id', j.target_id)
      .single();

    if (!target) {
      results.push({
        jobId: j.id,
        status: 'rejected',
        error: `Target not found for job ${j.id}`,
      });
      continue;
    }

    const platform = target.platform as ZernioPlatform;

    // Skip API call if this platform already hit its daily limit
    if (dailyLimitPlatforms.has(platform)) {
      await updatePublishJobStatus(
        j.id,
        'failed',
        undefined,
        'Daily limit already reached for this platform — skipped'
      );
      results.push({
        jobId: j.id,
        status: 'fulfilled',
        contentId: j.content_item_id,
        platform,
        success: false,
        error: 'Daily limit already reached for this platform — skipped',
      });
      continue;
    }

    const result = await publishVideo(j.content_item_id, platform, j.id);

    if (result.dailyLimitReached) {
      dailyLimitPlatforms.add(platform);
    }

    results.push({
      jobId: j.id,
      status: 'fulfilled',
      ...result,
    });
  }

  const successCount = results.filter((r) => r.success === true).length;

  return NextResponse.json({
    ran: jobs.length,
    succeeded: successCount,
    dailyLimitPlatforms: Array.from(dailyLimitPlatforms),
    results,
  });
}
