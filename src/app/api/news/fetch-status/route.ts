import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestFetchJob,
  updateFetchJob,
} from '@/infra/supabase/repositories/fetch-jobs.repository';
import { supabase } from '@/infra/supabase/client';

export const dynamic = 'force-dynamic';

const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche') ?? 'beach-tennis';

  const job = await getLatestFetchJob(niche).catch(() => null);
  if (!job) return NextResponse.json({ status: 'idle' });

  if (job.status === 'running') {
    // Job travado (container reiniciou enquanto rodava) → marca como falho
    const runningFor = Date.now() - new Date(job.started_at).getTime();
    if (runningFor > JOB_TIMEOUT_MS) {
      await updateFetchJob(job.id, {
        status: 'failed',
        errors: ['Job interrompido (timeout ou reinício do servidor)'],
        finished_at: new Date().toISOString(),
      });
      return NextResponse.json({ ...job, status: 'failed' });
    }

    // Conta itens inseridos desde o início do job para live feedback
    const { data } = await supabase
      .from('news_items')
      .select('status')
      .eq('niche', niche)
      .gte('created_at', job.started_at);

    const rows = data ?? [];
    return NextResponse.json({
      ...job,
      discovered: rows.length,
      scraped:    rows.filter((r) => r.status === 'scraped' || r.status === 'curated').length,
      failed:     rows.filter((r) => r.status === 'failed').length,
      duplicates: job.duplicates,
    });
  }

  return NextResponse.json(job);
}
