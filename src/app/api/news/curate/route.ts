import { NextResponse } from 'next/server';
import { curateScrapedNews } from '@/services/news-curate.service';

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await curateScrapedNews();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
