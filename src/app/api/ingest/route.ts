import { NextResponse } from 'next/server';
import { findContents } from '@/infra/supabase/repositories/content.repository';
import { ingestContent } from '@/services/ingest.service';

export const maxDuration = 300; // 5 min para Vercel Pro / Hobby ignora

export async function POST() {
  try {
    const { items } = await findContents({ status: 'discovered', limit: 20 });

    if (items.length === 0) {
      return NextResponse.json({ message: 'Nada para ingerir', processed: 0 });
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      const result = await ingestContent(item.id);
      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${item.source_video_id}: ${result.error}`);
      }
    }

    return NextResponse.json({
      processed: items.length,
      success,
      failed,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    console.error('Error running ingest batch:', error);
    return NextResponse.json({ error: 'Failed to run ingest' }, { status: 500 });
  }
}
