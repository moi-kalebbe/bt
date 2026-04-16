import { NextRequest, NextResponse } from 'next/server';
import { fetchNicheNews } from '@/services/news-fetch.service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let niche = 'beach-tennis';
    try {
      const body = await request.json();
      if (body?.niche) niche = body.niche;
    } catch {
      const text = await request.text().catch(() => '');
      niche = new URLSearchParams(text).get('niche') ?? 'beach-tennis';
    }
    const result = await fetchNicheNews(niche);
    return NextResponse.json({ ...result, niche });
  } catch (err) {
    console.error('[news/fetch] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch news' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') ?? 'beach-tennis';
    const result = await fetchNicheNews(niche);
    return NextResponse.json({ ...result, niche });
  } catch (err) {
    console.error('[news/fetch] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
