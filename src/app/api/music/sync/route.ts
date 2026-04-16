import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { syncViralTracks } from '@/services/music.service';

export async function POST(request: NextRequest) {
  try {
    const { niche = 'beach-tennis' } = await parseBody(request);
    const result = await syncViralTracks(niche, 50);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error syncing music:', error);
    return NextResponse.json(
      { error: 'Failed to sync music' },
      { status: 500 }
    );
  }
}
