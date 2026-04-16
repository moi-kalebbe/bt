import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { runScrape } from '@/services/scrape.service';
import { startIngestBackground } from '@/services/ingest-bg.service';

export async function POST(request: NextRequest) {
  try {
    const _body = await parseBody(request);
    const source = _body.source ?? 'both';
    const niche = _body.niche ?? 'beach-tennis';

    if (!['tiktok', 'youtube', 'both'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be "tiktok", "youtube", or "both"' },
        { status: 400 }
      );
    }

    const result = await runScrape(source as 'tiktok' | 'youtube' | 'both', niche);

    startIngestBackground(niche);

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

    startIngestBackground(niche);

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
