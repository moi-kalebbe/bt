import { NextResponse } from 'next/server';
import { renderTemplateToBuffer } from '@/services/news-compose.service';
import type { StoryTemplateConfig, PreviewSampleData } from '@/types/story-template';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      config: StoryTemplateConfig;
      sampleData: PreviewSampleData;
    };

    const { config, sampleData } = body;
    if (!config || !sampleData) {
      return NextResponse.json({ error: 'config and sampleData required' }, { status: 400 });
    }

    let coverBuffer: Buffer;

    if (sampleData.coverImageUrl && sampleData.coverImageUrl.startsWith('http')) {
      const res = await fetch(sampleData.coverImageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Failed to fetch cover image: ${res.status}`);
      coverBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      // Use placeholder solid color image when no URL provided
      const sharp = (await import('sharp')).default;
      coverBuffer = await sharp({
        create: { width: 1080, height: 1920, channels: 3, background: { r: 30, g: 30, b: 40 } },
      })
        .jpeg()
        .toBuffer();
    }

    const imageBuffer = await renderTemplateToBuffer(
      config,
      {
        title: sampleData.title,
        summary: sampleData.summary,
        sourceName: sampleData.sourceName,
        chipLabel: sampleData.chipLabel,
        titlePrefixPattern: /^/,
        coverBuffer,
      },
      { quality: 80 },
    );

    const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    return NextResponse.json({ imageBase64: base64 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
