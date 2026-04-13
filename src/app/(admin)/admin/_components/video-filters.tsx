'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CONTENT_STATUSES } from '@/lib/statuses';
import { normalizeStatusLabel } from '@/domain/content';
import { Search, X } from 'lucide-react';

interface VideoFiltersProps {
  currentSource: string;
  currentStatus?: string;
  currentAuthor: string;
  currentSlot?: string;
}

export function VideoFilters({
  currentSource,
  currentStatus,
  currentAuthor,
  currentSlot,
}: VideoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`/admin?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push('/admin');
  }, [router]);

  const hasFilters = currentSource || currentStatus || currentAuthor || currentSlot;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filtros</h2>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Buscar</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Autor ou título..."
            value={currentAuthor}
            onChange={(e) => updateFilter('author', e.target.value || undefined)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Fonte</label>
        <Select
          value={currentSource || 'all'}
          onValueChange={(value) => updateFilter('source', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as fontes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Status</label>
        <Select
          value={currentStatus || 'all'}
          onValueChange={(value) => updateFilter('status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {CONTENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {normalizeStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Slot</label>
        <Select
          value={currentSlot || 'all'}
          onValueChange={(value) => updateFilter('slot', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os slots" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os slots</SelectItem>
            <SelectItem value="morning">🌅 Manhã</SelectItem>
            <SelectItem value="night">🌙 Noite</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
