import { NextResponse } from 'next/server';
import { composeAllCurated } from '@/services/news-compose.service';

export const maxDuration = 300;

export async function POST() {
  try {
    const result = await composeAllCurated();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
