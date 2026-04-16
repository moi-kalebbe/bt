'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface JobState {
  jobId?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  discovered?: number;
  duplicates?: number;
  scraped?: number;
  failed?: number;
  errors?: string[];
}

const POLL_MS = 4_000;
// Para de polling se o contador não aumentar por N ticks consecutivos
const STALE_TICKS_LIMIT = 4; // 4 × 4s = 16s sem novos itens → considera concluído

export function FetchNewsButton({ niche }: { niche: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobState>({ status: 'idle' });
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDiscovered = useRef<number>(0);
  const staleTicks     = useRef<number>(0);

  useEffect(() => {
    fetch(`/api/news/fetch-status?niche=${niche}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.status === 'running') {
          setJob({ jobId: data.id, status: 'running',
                   discovered: data.discovered, scraped: data.scraped });
          prevDiscovered.current = data.discovered ?? 0;
          startPolling();
        }
      })
      .catch(() => null);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche]);

  function startPolling() {
    stopPolling();
    staleTicks.current = 0;
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/news/fetch-status?niche=${niche}`);
        const data = await res.json();
        if (!data || data.status === 'idle') return;

        const current = data.discovered ?? 0;

        // Detecta estagnação: contador parou de crescer
        if (current <= prevDiscovered.current) {
          staleTicks.current++;
        } else {
          staleTicks.current = 0;
          prevDiscovered.current = current;
        }

        const isStale = staleTicks.current >= STALE_TICKS_LIMIT;
        const isDone  = data.status !== 'running' || isStale;

        setJob({
          jobId:      data.id,
          status:     isDone ? 'completed' : 'running',
          discovered: current,
          duplicates: data.duplicates,
          scraped:    data.scraped,
          failed:     data.failed,
          errors:     data.errors,
        });

        router.refresh();

        if (isDone) stopPolling();
      } catch { /* ignora erro de rede */ }
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function handleStart() {
    prevDiscovered.current = 0;
    staleTicks.current = 0;
    setJob({ status: 'running' });
    try {
      const res  = await fetch('/api/news/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche }),
      });
      const data = await res.json();
      setJob({ jobId: data.jobId, status: 'running' });
      startPolling();
    } catch (err) {
      setJob({ status: 'failed', errors: [String(err)] });
    }
  }

  function handleDismiss() { stopPolling(); setJob({ status: 'idle' }); }

  if (job.status === 'idle') {
    return (
      <Button variant="outline" size="sm" onClick={handleStart}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Buscar Notícias
      </Button>
    );
  }

  const isRunning   = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed    = job.status === 'failed';

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-sm">
      {isRunning   && <RefreshCw    className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
      {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
      {isFailed    && <AlertCircle  className="h-3.5 w-3.5 text-destructive shrink-0" />}

      <div className="flex gap-3 text-muted-foreground">
        {isRunning   && <span className="font-medium text-foreground">Buscando…</span>}
        {isCompleted && <span className="font-medium text-emerald-600">Concluído</span>}
        {isFailed    && <span className="font-medium text-destructive">Falhou</span>}

        {job.discovered != null && <span>{job.discovered} descobertas</span>}
        {job.scraped    != null && <span>{job.scraped} raspadas</span>}
        {job.duplicates != null && job.duplicates > 0 && <span>{job.duplicates} duplicadas</span>}
        {job.failed     != null && job.failed     > 0 && <span className="text-destructive">{job.failed} falhas</span>}
      </div>

      {!isRunning && (
        <button onClick={handleDismiss} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
