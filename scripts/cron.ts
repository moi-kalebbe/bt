/**
 * Cron runner — pipeline multi-nicho.
 * Todos os horários em horário de Brasília (UTC-3).
 *
 * Nichos ativos: beach-tennis, ai-tech
 *
 * Jobs por nicho:
 *   - 00:00 BRT  scrape → ingest → cleanup → schedule (rotina noturna)
 *   - 08:00 BRT  publish
 *   - 11:30 BRT  publish
 *   - 18:00 BRT  publish
 *   - 21:30 BRT  publish
 *   - a cada 30min  ingest contínuo
 *   - a cada 5min   process-queue (1 vídeo por vez)
 *
 * Jobs de notícias por nicho:
 *   - 08:00 BRT  fetch → curate → compose → publish-today
 *   - 20:00 BRT  fetch → curate → compose → publish-today
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

// Nichos ativos — adicione novos nichos aqui
const ACTIVE_NICHES = ['beach-tennis', 'ai-tech'];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const BRT_OFFSET_MS = -3 * HOUR;

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
  };
}

async function call(label: string, path: string, body?: Record<string, string>): Promise<unknown> {
  const now = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  process.stdout.write(`[${now} BRT] ${label}... `);
  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: 'POST',
      headers: headers(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    console.log(res.ok ? '✓' : `✗ HTTP ${res.status}`, JSON.stringify(data).slice(0, 140));
    return data;
  } catch (err) {
    console.log('✗ erro:', (err as Error).message);
    return null;
  }
}

// ─── Pipelines por nicho ──────────────────────────────────────────────────────

async function nightlyPipeline(niche: string) {
  console.log(`\n── Rotina noturna [${niche}] ─────────────────────────────────`);
  await call(`scrape:${niche}`, '/api/scrape', { niche });

  console.log('  Aguardando ingest (até 10min)...');
  const start = Date.now();
  while (Date.now() - start < 10 * MIN) {
    const r = await call(`ingest:${niche}`, '/api/ingest', { niche }) as { processed?: number } | null;
    if (r !== null) break;
    await new Promise((res) => setTimeout(res, 30_000));
  }

  await call(`cleanup:${niche}`,       '/api/cleanup',       { niche });
  await call(`process-queue:${niche}`, '/api/process-queue', { niche });
  await call(`schedule:${niche}`,      '/api/schedule',      { niche });
  console.log(`── Rotina noturna [${niche}] concluída ──────────────────────\n`);
}

async function publishPipeline(niche: string) {
  await call(`publish:${niche}`, '/api/publish/run', { niche });
}

async function newsPipeline(niche: string) {
  console.log(`\n── Pipeline de notícias [${niche}] ──────────────────────────`);
  await call(`news-fetch:${niche}`,           '/api/news/fetch',           { niche });
  await call(`news-curate:${niche}`,          '/api/news/curate',          { niche });
  await call(`news-compose-pending:${niche}`, '/api/news/compose-pending', { niche });
  await call(`news-publish-today:${niche}`,   '/api/news/publish-today',   { niche });
  console.log(`── Pipeline de notícias [${niche}] concluído ─────────────────\n`);
}

// Processar todos os nichos em sequência (evita sobrecarga simultânea)
async function runForAllNiches(fn: (niche: string) => Promise<void>) {
  for (const niche of ACTIVE_NICHES) {
    await fn(niche);
  }
}

async function ingest() {
  for (const niche of ACTIVE_NICHES) {
    await call(`ingest:${niche}`, '/api/ingest', { niche });
  }
}

async function processQueue() {
  // process-queue não precisa de niche — processa por ordem de criação
  await call('process-queue', '/api/process-queue?limit=1');
}

// ─── Scheduler helpers ────────────────────────────────────────────────────────

function msUntilBRT(hour: number, minute: number): number {
  const now = Date.now();
  const nowBRT = new Date(now + BRT_OFFSET_MS);
  const target = new Date(nowBRT);
  target.setUTCHours(hour, minute, 0, 0);
  if (target.getTime() <= nowBRT.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - nowBRT.getTime();
}

function scheduleDaily(hour: number, minute: number, fn: () => Promise<void>, label: string) {
  const ms = msUntilBRT(hour, minute);
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  console.log(`  [${label}] próxima execução às ${hhmm} BRT (em ${Math.round(ms / MIN)}min)`);
  setTimeout(() => { fn(); setInterval(fn, DAY); }, ms);
}

function scheduleInterval(intervalMs: number, fn: () => Promise<void>, label: string) {
  console.log(`  [${label}] executando agora e a cada ${Math.round(intervalMs / MIN)}min`);
  fn();
  setInterval(fn, intervalMs);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

console.log(`\n🚀 Multi-nicho Pipeline — cron iniciado (fuso: Brasília UTC-3)`);
console.log(`   Nichos ativos: ${ACTIVE_NICHES.join(', ')}\n`);
console.log('Jobs agendados:');

scheduleDaily(0,  0,  () => runForAllNiches(nightlyPipeline),  'nightly-all');
scheduleDaily(8,  0,  () => runForAllNiches(publishPipeline),  'publish-1-all');
scheduleDaily(11, 30, () => runForAllNiches(publishPipeline),  'publish-2-all');
scheduleDaily(18, 0,  () => runForAllNiches(publishPipeline),  'publish-3-all');
scheduleDaily(21, 30, () => runForAllNiches(publishPipeline),  'publish-4-all');

scheduleDaily(8,  0,  () => runForAllNiches(newsPipeline),     'news-8h-all');
scheduleDaily(20, 0,  () => runForAllNiches(newsPipeline),     'news-20h-all');

scheduleInterval(30 * MIN, ingest,       'ingest-all');
scheduleInterval(5  * MIN, processQueue, 'process-queue');

console.log('\nPressione Ctrl+C para parar.\n');
process.stdin.resume();
