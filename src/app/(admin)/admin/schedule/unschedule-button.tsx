'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

interface UnscheduleButtonProps {
  videoId: string;
  size?: 'default' | 'sm' | 'icon';
}

export function UnscheduleButton({ videoId, size = 'sm' }: UnscheduleButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUnschedule = async () => {
    if (!confirm('Remover vídeo do slot?')) return;
    setLoading(true);
    try {
      await fetch(`/api/videos/${videoId}/unschedule`, { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const isIcon = size === 'icon';

  return (
    <Button
      variant="outline"
      size={isIcon ? 'icon' : 'sm'}
      onClick={handleUnschedule}
      disabled={loading}
      className={isIcon ? 'h-8 w-8' : 'h-8'}
      title="Remover do slot"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <X className="h-3 w-3" />
      )}
      {!isIcon && <span className="ml-1">Remover</span>}
    </Button>
  );
}
