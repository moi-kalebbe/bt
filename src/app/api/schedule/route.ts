import { NextRequest, NextResponse } from 'next/server';
import { selectAndScheduleVideos } from '@/services/schedule.service';

export async function POST(request: NextRequest) {
  try {
    const result = await selectAndScheduleVideos();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error running scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to run scheduler' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await selectAndScheduleVideos();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error running scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to run scheduler' },
      { status: 500 }
    );
  }
}
