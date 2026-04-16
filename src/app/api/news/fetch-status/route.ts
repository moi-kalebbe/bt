import { NextRequest, NextResponse } from 'next/server';
import { getLatestFetchJob } from '@/infra/supabase/repositories/fetch-jobs.repository';
import { supabase } from '@/infra/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche') ?? 'beach-tennis';

  const job = await getLatestFetchJob(niche).catch(() => null);
  if (!job) return NextResponse.json({ status: 'idle' });

  // Quando rodando, conta itens inseridos desde o início do job para live feedback
  if (job.status === 'running') {
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
      duplicates: job.duplicates, // só disponível após conclusão
    });
  }

  return NextResponse.json(job);
}
