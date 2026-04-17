import { NextRequest, NextResponse } from 'next/server';
import { unscheduleContent } from '@/infra/supabase/repositories/content.repository';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await unscheduleContent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unscheduling video:', error);
    return NextResponse.json({ error: 'Failed to unschedule video' }, { status: 500 });
  }
}
