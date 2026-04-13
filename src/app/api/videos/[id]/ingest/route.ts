import { NextRequest, NextResponse } from 'next/server';
import { ingestContent } from '@/services/ingest.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await ingestContent(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error ingesting video:', error);
    return NextResponse.json(
      { error: 'Failed to ingest video' },
      { status: 500 }
    );
  }
}
