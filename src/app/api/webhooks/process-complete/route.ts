import { NextRequest, NextResponse } from 'next/server';
import { processCallback } from '@/services/process.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentId, success, processedVideoKey, error } = body;

    if (!contentId) {
      return NextResponse.json(
        { error: 'contentId is required' },
        { status: 400 }
      );
    }

    await processCallback(contentId, success, processedVideoKey, error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing callback:', error);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}
