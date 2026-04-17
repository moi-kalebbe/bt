'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Variant = 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
type State = 'idle' | 'loading' | 'success' | 'error';

interface ToolbarActionButtonProps {
  apiPath: string;
  body?: Record<string, string>;
  label: string;
  labelShort?: string;
  icon: LucideIcon;
  variant?: Variant;
  successMessage?: string;
  refreshOnSuccess?: boolean;
}

export function ToolbarActionButton({
  apiPath,
  body,
  label,
  labelShort,
  icon: Icon,
  variant = 'outline',
  successMessage,
  refreshOnSuccess = true,
}: ToolbarActionButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  const handleClick = async () => {
    if (state === 'loading') return;
    setState('loading');
    setMessage('');

    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-ui': '1',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setState('error');
        setMessage(data.error ?? `Erro ${res.status}`);
      } else {
        setState('success');
        setMessage(successMessage ?? buildSuccessMessage(data));
        if (refreshOnSuccess) router.refresh();
      }
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Erro de rede');
    } finally {
      // Volta ao idle após 4s
      setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 4000);
    }
  };

  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const isError   = state === 'error';

  const buttonVariant: Variant =
    isError   ? 'destructive' :
    isSuccess ? 'outline' :
    variant;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <Button
        type="button"
        variant={buttonVariant}
        size="sm"
        onClick={handleClick}
        disabled={isLoading}
        className={isSuccess ? 'border-green-500 text-green-600' : ''}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : isSuccess ? (
          <Check className="mr-2 h-4 w-4" />
        ) : isError ? (
          <X className="mr-2 h-4 w-4" />
        ) : (
          <Icon className="mr-2 h-4 w-4" />
        )}
        {isLoading ? 'Aguarde...' : (
          <>
            {labelShort ? (
              <>
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{labelShort}</span>
              </>
            ) : label}
          </>
        )}
      </Button>
      {message && (
        <span className={`text-xs px-1 ${isError ? 'text-destructive' : 'text-green-600'}`}>
          {message}
        </span>
      )}
    </div>
  );
}

function buildSuccessMessage(data: Record<string, unknown>): string {
  // Mensagens específicas por endpoint
  if (data.scheduled !== undefined) return `${(data.scheduled as unknown[]).length ?? 0} vídeos agendados`;
  if (data.collected !== undefined) return `${data.collected} insights coletados`;
  if (data.ran !== undefined)       return `${data.succeeded ?? data.ran} publicados`;
  if (data.ingested !== undefined)  return `${data.ingested} ingeridos`;
  if (data.deleted !== undefined)   return `${data.deleted} removidos`;
  if (data.synced !== undefined)    return `${data.synced} músicas`;
  return 'Concluído';
}
