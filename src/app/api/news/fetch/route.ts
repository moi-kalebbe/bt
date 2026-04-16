import { NextResponse } from 'next/server';
import { fetchBeachTennisNews } from '@/services/news-fetch.service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await fetchBeachTennisNews();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[news/fetch] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
