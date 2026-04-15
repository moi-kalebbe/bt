import { NextRequest, NextResponse } from 'next/server';
import { findContentById } from '@/infra/supabase/repositories/content.repository';
import { publishVideo } from '@/services/publish.service';
import { processVideo } from '@/services/process.service';
import { supabase } from '@/infra/supabase/client';
import type { ZernioPlatform } from '@/infra/zernio/client';

export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let content = await findContentById(id);
  if (!content) {
    return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
  }

  // Se ainda não foi processado pelo FFmpeg, processa primeiro
  if (!content.processed_video_r2_key) {
    if (!content.original_video_r2_key) {
      return NextResponse.json(
        { error: 'Vídeo original não disponível. Faça o ingest antes de publicar.' },
        { status: 400 }
      );
    }

    const processResult = await processVideo(id);
    if (!processResult.success) {
      return NextResponse.json(
        { error: `Falha ao processar vídeo: ${processResult.error}` },
        { status: 500 }
      );
    }

    // Recarrega o content com o processed_video_r2_key atualizado
    content = await findContentById(id);
    if (!content?.processed_video_r2_key) {
      return NextResponse.json(
        { error: 'Processamento concluído mas chave do vídeo não encontrada' },
        { status: 500 }
      );
    }
  }

  // Fetch all active publish targets
  const { data: targets, error: targetsError } = await supabase
    .from('publish_targets')
    .select('*')
    .eq('active', true);

  if (targetsError) {
    return NextResponse.json({ error: 'Erro ao buscar targets de publicação' }, { status: 500 });
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: 'Nenhum target de publicação ativo configurado' }, { status: 400 });
  }

  // Fetch any existing scheduled publish_jobs for this content to avoid cron re-publishing
  const { data: existingJobs } = await supabase
    .from('publish_jobs')
    .select('id, target_id')
    .eq('content_item_id', id)
    .eq('status', 'scheduled');

  const jobByTargetId = new Map<string, string>(
    (existingJobs ?? []).map((j: { id: string; target_id: string }) => [j.target_id, j.id])
  );

  // Deduplicate targets by platform (publish once per platform)
  const seenPlatforms = new Set<string>();
  const results = await Promise.allSettled(
    targets
      .filter((target: { id: string; platform: string }) => {
        if (seenPlatforms.has(target.platform)) return false;
        seenPlatforms.add(target.platform);
        return true;
      })
      .map((target: { id: string; platform: string }) => {
        const jobId = jobByTargetId.get(target.id);
        return publishVideo(id, target.platform as ZernioPlatform, jobId);
      })
  );

  const summary = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { success: false, error: String((r as PromiseRejectedResult).reason) }
  );

  const succeeded = summary.filter((s) => s.success).length;
  const failed = summary.length - succeeded;

  return NextResponse.json({ succeeded, failed, results: summary });
}
