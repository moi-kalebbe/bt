import { NextRequest, NextResponse } from 'next/server';
import { getLatestFetchJob } from '@/infra/supabase/repositories/fetch-jobs.repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get('niche') ?? 'beach-tennis';

  const job = await getLatestFetchJob(niche).catch(() => null);
  return NextResponse.json(job ?? { status: 'idle' });
}
