import { findContents } from '@/infra/supabase/repositories/content.repository';
import { ingestContent } from '@/services/ingest.service';

let isRunning = false;

/**
 * Roda em segundo plano sem bloquear. Processa todos os 'discovered' em fila.
 * Seguro chamar múltiplas vezes — ignora novas chamadas se já estiver ativo.
 */
export function startIngestBackground() {
  if (isRunning) {
    console.log('[ingest-bg] Já está rodando, ignorando chamada duplicada.');
    return;
  }

  isRunning = true;
  console.log('[ingest-bg] Iniciando processamento em segundo plano...');

  // Fire-and-forget: não fazemos await aqui
  runLoop()
    .catch((err) => console.error('[ingest-bg] Erro fatal:', err))
    .finally(() => {
      isRunning = false;
      console.log('[ingest-bg] Finalizado.');
    });
}

async function runLoop() {
  let totalProcessed = 0;

  while (true) {
    // Pega um lote pequeno para não sobrecarregar memória
    const { items } = await findContents({ status: 'discovered', limit: 10 });

    if (items.length === 0) {
      console.log(`[ingest-bg] Sem mais itens para ingerir. Total processado: ${totalProcessed}`);
      break;
    }

    console.log(`[ingest-bg] Processando lote de ${items.length} itens...`);

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
