import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { curateScrapedNews } from '@/services/news-curate.service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Lock em memória — evita curadoria paralela no mesmo nicho (single container)
const running = new Set<string>();

async function runCuration(niche: string) {
  try {
    await curateScrapedNews(niche);
  } finally {
    running.delete(niche);
  }
}

function startCuration(niche: string): NextResponse {
  if (running.has(niche)) {
    return NextResponse.json({ status: 'already_running', niche }, { status: 202 });
  }
  running.add(niche);
  void runCuration(niche);
  return NextResponse.json({ status: 'started', niche }, { status: 202 });
}

export async function POST(request: NextRequest) {
  try {
    const { niche = 'beach-tennis' } = await parseBody(request);
    return startCuration(niche);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') ?? 'beach-tennis';
    return startCuration(niche);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
