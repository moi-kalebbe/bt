import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { composeAllCurated } from '@/services/news-compose.service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const running = new Set<string>();

async function runCompose(niche: string | undefined) {
  const key = niche ?? 'all';
  try {
    await composeAllCurated(niche);
  } finally {
    running.delete(key);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { niche } = await parseBody(request);
    const key = niche ?? 'all';
    if (running.has(key)) {
      return NextResponse.json({ status: 'already_running', niche }, { status: 202 });
    }
    running.add(key);
    void runCompose(niche);
    return NextResponse.json({ status: 'started', niche }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
