import { NextRequest, NextResponse } from 'next/server';
import { curateScrapedNews } from '@/services/news-curate.service';

export const maxDuration = 120;

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
    const result = await curateScrapedNews(niche);
    return NextResponse.json({ ...result, niche });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') ?? 'beach-tennis';
    const result = await curateScrapedNews(niche);
    return NextResponse.json({ ...result, niche });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
