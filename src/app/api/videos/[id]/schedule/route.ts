import { NextRequest, NextResponse } from 'next/server';
import { manualSchedule } from '@/services/schedule.service';
import type { Slot } from '@/types/domain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const slot = body.slot as Slot;

    if (!slot || !['morning', 'night'].includes(slot)) {
      return NextResponse.json(
        { error: 'Invalid slot. Must be "morning" or "night"' },
        { status: 400 }
      );
    }

    const result = await manualSchedule(id, slot);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, contentId: id, slot });
  } catch (error) {
    console.error('Error scheduling video:', error);
    return NextResponse.json(
      { error: 'Failed to schedule video' },
      { status: 500 }
    );
  }
}
