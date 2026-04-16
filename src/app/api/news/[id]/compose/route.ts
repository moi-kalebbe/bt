import { NextRequest, NextResponse } from 'next/server';
import { composeStoryArt } from '@/services/news-compose.service';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await composeStoryArt(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
