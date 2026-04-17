import { NextResponse } from 'next/server';
import {
  upsertTemplate,
  toggleTemplateActive,
} from '@/infra/supabase/repositories/story-templates.repository';
import type { StoryTemplateConfig } from '@/types/story-template';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  try {
    const { slot: slotStr } = await params;
    const slot = parseInt(slotStr, 10) as 1 | 2 | 3;
    if (slot < 1 || slot > 3) return NextResponse.json({ error: 'slot must be 1–3' }, { status: 400 });

    const body = await request.json() as {
      niche: string;
      name: string;
      config: StoryTemplateConfig;
      is_active: boolean;
    };

    const template = await upsertTemplate(body.niche, slot, {
      name: body.name,
      config: body.config,
      is_active: body.is_active,
    });

    return NextResponse.json({ template });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  try {
    const { slot: slotStr } = await params;
    const slot = parseInt(slotStr, 10) as 1 | 2 | 3;
    if (slot < 1 || slot > 3) return NextResponse.json({ error: 'slot must be 1–3' }, { status: 400 });

    const body = await request.json() as { niche: string; is_active: boolean };
    const template = await toggleTemplateActive(body.niche, slot, body.is_active);
    return NextResponse.json({ template });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
