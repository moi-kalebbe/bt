import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/infra/supabase/client';
import { processVideo } from '@/services/process.service';

export const maxDuration = 300;

// Processa todos os vídeos ready que ainda não passaram pelo FFmpeg
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: items, error } = await supabase
    .from('content_items')
    .select('id')
    .eq('status', 'ready')
    .is('processed_video_r2_key', null)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({ processed: 0, message: 'Nada para processar' });
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const result = await processVideo(item.id);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${item.id}: ${result.error}`);
    }
  }

  return NextResponse.json({ processed: items.length, success, failed, errors });
}
