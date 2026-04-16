import { NextRequest, NextResponse } from 'next/server';
import { runScrape } from '@/services/scrape.service';
import { startIngestBackground } from '@/services/ingest-bg.service';

export async function POST(request: NextRequest) {
  try {
    let source = 'both';
    let niche = 'beach-tennis';
    try {
      const body = await request.json();
      if (body?.source) source = body.source;
      if (body?.niche) niche = body.niche;
    } catch {
      const text = await request.text().catch(() => '');
      const params = new URLSearchParams(text);
      source = params.get('source') ?? 'both';
      niche = params.get('niche') ?? 'beach-tennis';
    }

    if (!['tiktok', 'youtube', 'both'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be "tiktok", "youtube", or "both"' },
        { status: 400 }
      );
    }

    const result = await runScrape(source as 'tiktok' | 'youtube' | 'both', niche);

    startIngestBackground();

    return NextResponse.json({
      ...result,
      niche,
      message: 'Coleta concluída. Download dos vídeos iniciado em segundo plano.',
    });
  } catch (error) {
    console.error('Error running scrape:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run scrape' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') ?? 'beach-tennis';

    const result = await runScrape('both', niche);

    startIngestBackground();

    return NextResponse.json({
      ...result,
      niche,
      message: 'Coleta concluída. Download dos vídeos iniciado em segundo plano.',
    });
  } catch (error) {
    console.error('Error running scrape:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run scrape' },
      { status: 500 }
    );
  }
}
