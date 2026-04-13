import { NextRequest, NextResponse } from 'next/server';
import { findScheduledJobs } from '@/infra/supabase/repositories/publish-jobs.repository';
import { publishVideo } from '@/services/publish.service';
import { supabase } from '@/infra/supabase/client';
import type { ZernioPlatform } from '@/infra/zernio/client';

// Called by cron (e.g., Vercel Cron, external service) every 30 min
// Picks up all publish_jobs where scheduled_for <= now and status = 'scheduled'
export async function POST(request: NextRequest) {
  // Optional secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobs = await findScheduledJobs();

  if (jobs.length === 0) {
    return NextResponse.json({ ran: 0, results: [] });
  }

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      // Resolve the platform from the associated publish_target
      const { data: target } = await supabase
        .from('publish_targets')
        .select('platform')
        .eq('id', (job as unknown as { target_id: string }).target_id)
        .single();

      if (!target) {
        throw new Error(`Target not found for job ${(job as unknown as { id: string }).id}`);
      }

      return publishVideo(
        (job as unknown as { content_item_id: string }).content_item_id,
        target.platform as ZernioPlatform,
        (job as unknown as { id: string }).id
      );
    })
  );

  const summary = results.map((r, i) => ({
    jobId: (jobs[i] as unknown as { id: string }).id,
    status: r.status,
    ...(r.status === 'fulfilled' ? r.value : { error: String((r as PromiseRejectedResult).reason) }),
  }));

  const successCount = summary.filter((s) => s.status === 'fulfilled' && (s as { success?: boolean }).success).length;

  return NextResponse.json({ ran: jobs.length, succeeded: successCount, results: summary });
}
