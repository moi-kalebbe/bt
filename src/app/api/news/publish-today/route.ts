import { NextResponse } from 'next/server';
import { publishTodayNews } from '@/services/news-publish.service';

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await publishTodayNews();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
