/**
 * Local cron runner — pipeline completo.
 * Substitui Vercel Cron / serviço externo durante desenvolvimento local.
 *
 * Uso: npm run cron
 *
 * Jobs:
 *   - Scrape:   a cada 6h
 *   - Ingest:   a cada 30min
 *   - Schedule: diário às 06:00 (seleciona os 2 melhores vídeos do dia)
 *   - Publish:  diário às 08:00 e 18:00
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

async function call(label: string, path: string, method = 'POST') {
  const now = new Date().toLocaleTimeString('pt-BR');
  process.stdout.write(`[${now}] ${label}... `);
  try {
    const res = await fetch(`${APP_URL}${path}`, { method, headers: headers() });
    const data = await res.json();
    console.log(res.ok ? '✓' : `✗ HTTP ${res.status}`, JSON.stringify(data).slice(0, 120));
  } catch (err) {
    console.log('✗ erro:', (err as Error).message);
  }
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

async function scrape()    { await call('scrape',    '/api/scrape');         }
async function ingest()    { await call('ingest',    '/api/ingest', 'POST'); }
async function schedule()  { await call('schedule',  '/api/schedule');       }
async function publish()   { await call('publish',   '/api/publish/run');    }

// ─── Scheduler helpers ───────────────────────────────────────────────────────

/** Agenda execução no próximo HH:00 e depois a cada `intervalMs`. */
function scheduleAtHours(hours: number[], fn: () => Promise<void>, label: string) {
  const now = new Date();

  for (const hour of hours) {
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const msUntil = next.getTime() - now.getTime();
    const hhmm = `${String(hour).padStart(2, '0')}:00`;
    console.log(`  [${label}] próxima execução às ${hhmm} (em ${Math.round(msUntil / MIN)}min)`);

    setTimeout(() => {
      fn();
      setInterval(fn, DAY);
    }, msUntil);
  }
}

/** Agenda execução imediata e depois a cada `intervalMs`. */
function scheduleInterval(intervalMs: number, fn: () => Promise<void>, label: string) {
  const mins = Math.round(intervalMs / MIN);
  console.log(`  [${label}] executando agora e a cada ${mins}min`);
  fn();
  setInterval(fn, intervalMs);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

console.log('\n🎾 Beach Tennis Pipeline — cron local iniciado\n');
console.log('Jobs agendados:');

// Scrape: a cada 6h, começa imediatamente
scheduleInterval(6 * HOUR, scrape, 'scrape');

// Ingest: a cada 30min, começa imediatamente
scheduleInterval(30 * MIN, ingest, 'ingest');

// Schedule (seleção de vídeos): todo dia às 06:00
scheduleAtHours([6], schedule, 'schedule');

// Publish: todo dia às 08:00 e 18:00
scheduleAtHours([8, 18], publish, 'publish');

console.log('\nPressione Ctrl+C para parar.\n');
process.stdin.resume();
