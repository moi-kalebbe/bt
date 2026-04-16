import { NextResponse } from 'next/server';
import { clearNewsItems } from '@/infra/supabase/repositories/news.repository';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const niche: string = body.niche ?? 'beach-tennis';

    const deleted = await clearNewsItems(niche);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
