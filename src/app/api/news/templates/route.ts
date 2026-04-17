import { NextResponse } from 'next/server';
import { getTemplatesForNiche } from '@/infra/supabase/repositories/story-templates.repository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche');
    if (!niche) return NextResponse.json({ error: 'niche param required' }, { status: 400 });

    const templates = await getTemplatesForNiche(niche);
    return NextResponse.json({ templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
