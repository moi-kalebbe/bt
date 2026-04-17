import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { fetchNicheNews } from '@/services/news-fetch.service';
import {
  createFetchJob,
  updateFetchJob,
  getLatestFetchJob,
} from '@/infra/supabase/repositories/fetch-jobs.repository';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos — job mais velho que isso está travado

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

async function startJob(niche: string): Promise<NextResponse> {
  // Guard: impede múltiplos jobs simultâneos
  const existing = await getLatestFetchJob(niche).catch(() => null);
  if (existing?.status === 'running') {
    const age = Date.now() - new Date(existing.started_at).getTime();
    if (age < JOB_TIMEOUT_MS) {
      // Job ativo e dentro do timeout — devolve o existente sem criar outro
      return NextResponse.json({ jobId: existing.id, status: 'running', niche, alreadyRunning: true });
    }
    // Job travado além do timeout — mata e deixa criar novo
    await updateFetchJob(existing.id, {
      status: 'failed',
      errors: ['Timeout: job interrompido após 10 minutos sem conclusão'],
      finished_at: new Date().toISOString(),
    }).catch(() => null);
  }

  const job = await createFetchJob(niche);
  void runJob(job.id, niche);
  return NextResponse.json({ jobId: job.id, status: 'running', niche });
}

export async function POST(request: NextRequest) {
  try {
    const { niche = 'beach-tennis' } = await parseBody(request);
    return startJob(niche);
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
    return startJob(niche);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start fetch job' },
      { status: 500 }
    );
  }
}
