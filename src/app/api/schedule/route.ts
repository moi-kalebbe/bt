import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { selectAndScheduleVideos } from '@/services/schedule.service';

export async function POST(request: NextRequest) {
  try {
    const { niche = 'beach-tennis' } = await parseBody(request);

    const result = await selectAndScheduleVideos(niche);
    return NextResponse.json({ success: true, niche, ...result });
  } catch (error) {
    console.error('Error running scheduler:', error);
    return NextResponse.json({ error: 'Failed to run scheduler' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const niche = request.nextUrl.searchParams.get('niche') ?? 'beach-tennis';
    const result = await selectAndScheduleVideos(niche);
    return NextResponse.json({ success: true, niche, ...result });
  } catch (error) {
    console.error('Error running scheduler:', error);
    return NextResponse.json({ error: 'Failed to run scheduler' }, { status: 500 });
  }
}
