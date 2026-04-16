/**
 * Cron runner — pipeline completo Beach Tennis.
 * Todos os horários em horário de Brasília (UTC-3).
 *
 * Jobs:
 *   - 00:00 BRT  scrape → ingest → cleanup → schedule (rotina noturna)
 *   - 08:00 BRT  publish
 *   - 11:30 BRT  publish
 *   - 18:00 BRT  publish
 *   - 21:30 BRT  publish
 *   - a cada 30min  ingest contínuo
 *   - a cada 5min   process-queue (1 vídeo por vez)
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// UTC-3 (Brasília) — não muda com horário de verão desde 2019
const BRT_OFFSET_MS = -3 * HOUR;

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
  };
}

async function call(label: string, path: string): Promise<unknown> {
  const now = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  process.stdout.write(`[${now} BRT] ${label}... `);
  try {
    const res = await fetch(`${APP_URL}${path}`, { method: 'POST', headers: headers() });
    const data = await res.json();
    console.log(res.ok ? '✓' : `✗ HTTP ${res.status}`, JSON.stringify(data).slice(0, 140));
    return data;
  } catch (err) {
    console.log('✗ erro:', (err as Error).message);
    return null;
  }
}

// ─── Rotina noturna (00:00 BRT) ──────────────────────────────────────────────

async function nightlyPipeline() {
  console.log('\n── Rotina noturna iniciada ──────────────────────────────────');
  await call('scrape', '/api/scrape');

  console.log('  Aguardando ingest (até 10min)...');
  const start = Date.now();
  while (Date.now() - start < 10 * MIN) {
    const r = await call('ingest', '/api/ingest') as { processed?: number } | null;
    if (r !== null) break;
    await new Promise((res) => setTimeout(res, 30_000));
  }

  await call('cleanup', '/api/cleanup');
  await call('process-queue', '/api/process-queue');
  await call('schedule', '/api/schedule');
  console.log('── Rotina noturna concluída ─────────────────────────────────\n');
}

async function ingest()        { await call('ingest',         '/api/ingest');               }
async function publish()       { await call('publish',        '/api/publish/run');          }
async function processQueue()  { await call('process-queue',  '/api/process-queue?limit=1'); }

async function newsPipeline() {
  console.log('\n── Pipeline de notícias iniciado ────────────────────────────');
  await call('news-fetch',           '/api/news/fetch');
  await call('news-curate',          '/api/news/curate');
  await call('news-compose-pending', '/api/news/compose-pending');
  await call('news-publish-today',   '/api/news/publish-today');
  console.log('── Pipeline de notícias concluído ───────────────────────────\n');
}

// ─── Scheduler helpers ────────────────────────────────────────────────────────

/** Retorna ms até o próximo HH:MM no fuso de Brasília. */
function msUntilBRT(hour: number, minute: number): number {
  const now = Date.now();
  // Hora atual em BRT
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

console.log('\n🎾 Beach Tennis Pipeline — cron iniciado (fuso: Brasília UTC-3)\n');
console.log('Jobs agendados:');

scheduleDaily(0,  0,  nightlyPipeline, 'nightly');   // 00:00 BRT
scheduleDaily(8,  0,  publish,         'publish-1');  // 08:00 BRT
scheduleDaily(11, 30, publish,         'publish-2');  // 11:30 BRT
scheduleDaily(18, 0,  publish,         'publish-3');  // 18:00 BRT
scheduleDaily(21, 30, publish,         'publish-4');  // 21:30 BRT

scheduleDaily(8,  0,  newsPipeline,    'news-8h');    // 08:00 BRT — notícias matutinas
scheduleDaily(20, 0,  newsPipeline,    'news-20h');   // 20:00 BRT — notícias noturnas

scheduleInterval(30 * MIN, ingest,       'ingest');
scheduleInterval(5  * MIN, processQueue, 'process-queue');

console.log('\nPressione Ctrl+C para parar.\n');
process.stdin.resume();
