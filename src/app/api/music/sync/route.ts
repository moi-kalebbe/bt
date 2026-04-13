import { NextResponse } from 'next/server';
import { syncViralTracks } from '@/services/music.service';

export async function POST() {
  try {
    const result = await syncViralTracks(50);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error syncing music:', error);
    return NextResponse.json(
      { error: 'Failed to sync music' },
      { status: 500 }
    );
  }
}
