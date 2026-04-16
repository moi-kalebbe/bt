'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function ClearNewsButton({ niche }: { niche: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClear() {
    if (!window.confirm(`Deletar TODAS as notícias do nicho "${niche}"? Esta ação não pode ser desfeita.`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/news/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleClear} disabled={loading}>
      <Trash2 className="mr-2 h-4 w-4" />
      {loading ? 'Limpando…' : 'Limpar Banco'}
    </Button>
  );
}
