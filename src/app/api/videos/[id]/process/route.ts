import { NextRequest, NextResponse } from 'next/server';
import { processVideo } from '@/services/process.service';
import type { ProcessingProfile } from '@/types/domain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const profile: ProcessingProfile = body.profile ?? 'reels';

    const result = await processVideo(id, undefined, profile);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, contentId: id, processedVideoKey: result.processedVideoKey });
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json({ error: 'Failed to process video' }, { status: 500 });
  }
}
