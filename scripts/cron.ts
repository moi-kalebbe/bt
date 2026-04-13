/**
 * Cron runner — pipeline completo Beach Tennis.
 *
 * Jobs:
 *   - 00:00  scrape → ingest → cleanup → schedule  (rotina noturna completa)
 *   - 08:00  publish (slot manhã)
 *   - 18:00  publish (slot tarde)
 *   - a cada 30min  ingest (mantém fila sempre abastecida)
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
  };
}

async function call(label: string, path: string): Promise<unknown> {
  const now = new Date().toLocaleTimeString('pt-BR');
  process.stdout.write(`[${now}] ${label}... `);
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

// ─── Rotina noturna (00:00) ───────────────────────────────────────────────────
// Roda em sequência: scrape → aguarda ingest → cleanup → schedule

async function nightlyPipeline() {
  console.log('\n── Rotina noturna iniciada ──────────────────────────────────');

  // 1. Scrape — coleta novos vídeos
  await call('scrape', '/api/scrape');

  // 2. Ingest — baixa e salva no R2 (pode demorar; tentamos por até 10min)
  console.log('  Aguardando ingest (até 10min)...');
  const ingestStart = Date.now();
  const INGEST_TIMEOUT = 10 * MIN;
  let ingestOk = false;

  while (Date.now() - ingestStart < INGEST_TIMEOUT) {
    const result = await call('ingest', '/api/ingest') as { processed?: number } | null;
    if (result !== null) { ingestOk = true; break; }
    await new Promise((r) => setTimeout(r, 30_000)); // retry em 30s se falhar
  }

  if (!ingestOk) {
    console.log('  ⚠ Ingest não concluiu no tempo esperado, continuando mesmo assim...');
  }

  // 3. Cleanup — remove não-beach-tennis do Supabase + R2
  await call('cleanup', '/api/cleanup');

  // 4. Schedule — seleciona os 2 melhores vídeos do dia
  await call('schedule', '/api/schedule');

  console.log('── Rotina noturna concluída ─────────────────────────────────\n');
}

async function ingest()   { await call('ingest',   '/api/ingest');       }
async function publish()  { await call('publish',  '/api/publish/run');  }

// ─── Scheduler helpers ────────────────────────────────────────────────────────

function scheduleAtHours(hours: number[], fn: () => Promise<void>, label: string) {
  const now = new Date();
  for (const hour of hours) {
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const msUntil = next.getTime() - now.getTime();
    const hhmm = `${String(hour).padStart(2, '0')}:00`;
    console.log(`  [${label}] próxima execução às ${hhmm} (em ${Math.round(msUntil / MIN)}min)`);

    setTimeout(() => { fn(); setInterval(fn, DAY); }, msUntil);
  }
}

function scheduleInterval(intervalMs: number, fn: () => Promise<void>, label: string) {
  const mins = Math.round(intervalMs / MIN);
  console.log(`  [${label}] executando agora e a cada ${mins}min`);
  fn();
  setInterval(fn, intervalMs);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

console.log('\n🎾 Beach Tennis Pipeline — cron iniciado\n');
console.log('Jobs agendados:');

// Rotina noturna completa: meia-noite
scheduleAtHours([0], nightlyPipeline, 'nightly');

// Ingest contínuo: a cada 30min (mantém fila abastecida durante o dia)
scheduleInterval(30 * MIN, ingest, 'ingest');

// Publicação: 08:00 e 18:00
scheduleAtHours([8, 18], publish, 'publish');

console.log('\nPressione Ctrl+C para parar.\n');
process.stdin.resume();
