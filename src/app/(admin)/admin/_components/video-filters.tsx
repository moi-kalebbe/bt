'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CONTENT_STATUSES } from '@/lib/statuses';
import { normalizeStatusLabel } from '@/domain/content';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface VideoFiltersProps {
  currentSource: string;
  currentStatus?: string;
  currentAuthor: string;
  currentSlot?: string;
  mobileMode?: boolean;
}

export function VideoFilters(props: VideoFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (props.mobileMode) {
    const hasFilters = props.currentSource || props.currentStatus || props.currentAuthor || props.currentSlot;
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {hasFilters && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">
              {[props.currentSource, props.currentStatus, props.currentAuthor, props.currentSlot].filter(Boolean).length}
            </Badge>
          )}
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-72">
            <SheetHeader className="mb-4">
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <FilterPanel {...props} onClose={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <FilterPanel {...props} />
    </div>
  );
}

function FilterPanel({
  currentSource,
  currentStatus,
  currentAuthor,
  currentSlot,
  onClose,
}: VideoFiltersProps & { onClose?: () => void }) {
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
    onClose?.();
  }, [router, onClose]);

  const hasFilters = currentSource || currentStatus || currentAuthor || currentSlot;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Filtros</h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
            <X className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Buscar</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Autor ou título..."
            value={currentAuthor}
            onChange={(e) => updateFilter('author', e.target.value || undefined)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Fonte</label>
        <Select value={currentSource || 'all'} onValueChange={(v) => updateFilter('source', v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={currentStatus || 'all'} onValueChange={(v) => updateFilter('status', v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos" />
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

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Slot</label>
        <Select value={currentSlot || 'all'} onValueChange={(v) => updateFilter('slot', v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os slots</SelectItem>
            <SelectItem value="morning">Manhã (08:00)</SelectItem>
            <SelectItem value="midday">Meio-dia (11:30)</SelectItem>
            <SelectItem value="evening">Tarde (18:00)</SelectItem>
            <SelectItem value="night">Noite (21:30)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
