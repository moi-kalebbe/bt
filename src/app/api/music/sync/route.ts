import { NextRequest, NextResponse } from 'next/server';
import { syncViralTracks } from '@/services/music.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const niche = (body?.niche as string) || 'beach-tennis';
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
