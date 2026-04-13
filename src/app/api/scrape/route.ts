import { NextRequest, NextResponse } from 'next/server';
import { runScrape } from '@/services/scrape.service';
import { startIngestBackground } from '@/services/ingest-bg.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = body.source ?? 'both';

    if (!['tiktok', 'youtube', 'both'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be "tiktok", "youtube", or "both"' },
        { status: 400 }
      );
    }

    const result = await runScrape(source);

    // Dispara o download em segundo plano (não bloqueia a resposta)
    startIngestBackground();

    return NextResponse.json({
      ...result,
      message: 'Coleta concluída. Download dos vídeos iniciado em segundo plano.',
    });
  } catch (error) {
    console.error('Error running scrape:', error);
    return NextResponse.json(
      { error: 'Failed to run scrape' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await runScrape('both');

    // Dispara o download em segundo plano (não bloqueia a resposta)
    startIngestBackground();

    return NextResponse.json({
      ...result,
      message: 'Coleta concluída. Download dos vídeos iniciado em segundo plano.',
    });
  } catch (error) {
    console.error('Error running scrape:', error);
    return NextResponse.json(
      { error: 'Failed to run scrape' },
      { status: 500 }
    );
  }
}
