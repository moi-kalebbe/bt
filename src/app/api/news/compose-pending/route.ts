import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { composeAllCurated } from '@/services/news-compose.service';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { niche } = await parseBody(request);

    const result = await composeAllCurated(niche);
    return NextResponse.json({ ...result, niche });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
