import { NextRequest, NextResponse } from 'next/server';
import { publishNewsStory } from '@/services/news-publish.service';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await publishNewsStory(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
