import { NextRequest, NextResponse } from 'next/server';
import { selectAndScheduleVideos } from '@/services/schedule.service';

export async function POST(request: NextRequest) {
  try {
    let niche = 'beach-tennis';
    try {
      const body = await request.json();
      if (body?.niche) niche = body.niche;
    } catch {
      // form POST (application/x-www-form-urlencoded)
      const text = await request.text().catch(() => '');
      const params = new URLSearchParams(text);
      niche = params.get('niche') ?? 'beach-tennis';
    }

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
