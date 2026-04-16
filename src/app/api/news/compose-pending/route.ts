import { NextRequest, NextResponse } from 'next/server';
import { composeAllCurated } from '@/services/news-compose.service';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    let niche: string | undefined;
    try {
      const body = await request.json();
      if (body?.niche) niche = body.niche;
    } catch {
      const text = await request.text().catch(() => '');
      niche = new URLSearchParams(text).get('niche') ?? undefined;
    }

    const result = await composeAllCurated(niche);
    return NextResponse.json({ ...result, niche });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
