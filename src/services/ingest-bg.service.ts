import { findContents } from '@/infra/supabase/repositories/content.repository';
import { ingestContent } from '@/services/ingest.service';

let runningNiches = new Set<string>();

/**
 * Roda em segundo plano sem bloquear. Processa itens 'discovered' do nicho informado.
 * Seguro chamar múltiplas vezes — ignora se o nicho já estiver em processamento.
 */
export function startIngestBackground(niche: string = 'beach-tennis') {
  if (runningNiches.has(niche)) {
    console.log(`[ingest-bg] Nicho "${niche}" já está rodando, ignorando chamada duplicada.`);
    return;
  }

  runningNiches.add(niche);
  console.log(`[ingest-bg] Iniciando processamento em segundo plano para nicho: ${niche}`);

  runLoop(niche)
    .catch((err) => console.error(`[ingest-bg] Erro fatal (${niche}):`, err))
    .finally(() => {
      runningNiches.delete(niche);
      console.log(`[ingest-bg] Finalizado (${niche}).`);
    });
}

async function runLoop(niche: string) {
  let totalProcessed = 0;

  while (true) {
    const { items } = await findContents({ status: 'discovered', niche, limit: 10 });

    if (items.length === 0) {
      console.log(`[ingest-bg] Sem mais itens para ingerir (${niche}). Total processado: ${totalProcessed}`);
      break;
    }

    console.log(`[ingest-bg] Processando lote de ${items.length} itens (${niche})...`);

    for (const item of items) {
      try {
        const result = await ingestContent(item.id);
        if (result.success) {
          totalProcessed++;
          console.log(`[ingest-bg] ✅ ${item.source_video_id} → R2: ${result.originalVideoKey}`);
        } else {
          console.warn(`[ingest-bg] ⚠️ ${item.source_video_id} falhou: ${result.error}`);
        }
      } catch (err) {
        console.error(`[ingest-bg] ❌ Erro inesperado em ${item.source_video_id}:`, err);
      }
    }
  }
}
