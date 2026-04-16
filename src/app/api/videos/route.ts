import { NextRequest, NextResponse } from 'next/server';
import { findContents } from '@/infra/supabase/repositories/content.repository';
import type { ContentStatus, Slot } from '@/types/domain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const source = searchParams.get('source') ?? undefined;
    const status = searchParams.get('status') as ContentStatus | undefined;
    const author = searchParams.get('author') ?? undefined;
    const slot = searchParams.get('slot') as Slot | null | undefined;
    const niche = searchParams.get('niche') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const result = await findContents({
      source,
      status,
      authorUsername: author,
      selectedForSlot: slot,
      niche,
      limit,
      offset,
    });

    return NextResponse.json({
      items: result.items,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}
