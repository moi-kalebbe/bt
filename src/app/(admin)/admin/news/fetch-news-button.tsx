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

export function FetchNewsButton({ niche }: { niche: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobState>({ status: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Verifica se já há job rodando ao montar
  useEffect(() => {
    fetch(`/api/news/fetch-status?niche=${niche}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.status === 'running') {
          setJob({ jobId: data.id, status: 'running' });
          startPolling(data.id);
        }
      })
      .catch(() => null);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche]);

  function startPolling(jobId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/news/fetch-status?niche=${niche}`);
        const data = await res.json();
        if (!data || data.status === 'idle') return;

        setJob({
          jobId: data.id,
          status: data.status,
          discovered: data.discovered,
          duplicates: data.duplicates,
          scraped: data.scraped,
          failed: data.failed,
          errors: data.errors,
        });

        // Atualiza a lista de notícias enquanto o job roda
        router.refresh();

        if (data.status !== 'running') {
          stopPolling();
        }
      } catch { /* ignora erro de rede */ }
    }, 3_000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleStart() {
    setJob({ status: 'running' });
    try {
      const res = await fetch('/api/news/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche }),
      });
      const data = await res.json();
      setJob({ jobId: data.jobId, status: 'running' });
      startPolling(data.jobId);
    } catch (err) {
      setJob({ status: 'failed', errors: [String(err)] });
    }
  }

  function handleDismiss() {
    stopPolling();
    setJob({ status: 'idle' });
  }

  if (job.status === 'idle') {
    return (
      <Button variant="outline" size="sm" onClick={handleStart}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Buscar Notícias
      </Button>
    );
  }

  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-sm">
      {isRunning && (
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
      )}
      {isCompleted && (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      )}
      {isFailed && (
        <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}

      <div className="flex gap-3 text-muted-foreground">
        {isRunning && <span className="font-medium text-foreground">Buscando…</span>}
        {isCompleted && <span className="font-medium text-emerald-600">Concluído</span>}
        {isFailed && <span className="font-medium text-destructive">Falhou</span>}

        {job.discovered != null && (
          <span>{job.discovered} descobertas</span>
        )}
        {job.scraped != null && (
          <span>{job.scraped} raspadas</span>
        )}
        {job.duplicates != null && job.duplicates > 0 && (
          <span>{job.duplicates} duplicadas</span>
        )}
        {job.failed != null && job.failed > 0 && (
          <span className="text-destructive">{job.failed} falhas</span>
        )}
      </div>

      {!isRunning && (
        <button
          onClick={handleDismiss}
          className="ml-1 text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
