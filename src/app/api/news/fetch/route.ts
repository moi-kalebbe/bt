import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { fetchNicheNews } from '@/services/news-fetch.service';
import {
  createFetchJob,
  updateFetchJob,
} from '@/infra/supabase/repositories/fetch-jobs.repository';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function runJob(jobId: string, niche: string) {
  try {
    const result = await fetchNicheNews(niche);
    await updateFetchJob(jobId, {
      status: 'completed',
      discovered: result.discovered,
      duplicates: result.duplicates,
      scraped: result.scraped,
      failed: result.failed,
      errors: result.errors,
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    await updateFetchJob(jobId, {
      status: 'failed',
      errors: [err instanceof Error ? err.message : String(err)],
      finished_at: new Date().toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { niche = 'beach-tennis' } = await parseBody(request);
    const job = await createFetchJob(niche);

    // Fire and forget — continua rodando no servidor após resposta ser enviada
    void runJob(job.id, niche);

    return NextResponse.json({ jobId: job.id, status: 'running', niche });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start fetch job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') ?? 'beach-tennis';
    const job = await createFetchJob(niche);
    void runJob(job.id, niche);
    return NextResponse.json({ jobId: job.id, status: 'running', niche });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start fetch job' },
      { status: 500 }
    );
  }
}
