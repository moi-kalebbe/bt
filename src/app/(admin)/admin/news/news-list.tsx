'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { NewsItem, NewsStatus } from '@/types/domain';

interface NewsListProps {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
  status?: NewsStatus;
  niche?: string;
}

export function NewsList({ items, total, page, limit, status, niche }: NewsListProps) {
  const totalPages = Math.ceil(total / limit);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        <p className="text-sm">
          Nenhuma notícia encontrada.
          <br />
          Use o botão <strong>Buscar Notícias</strong> para iniciar a coleta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Notícia</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                Fonte
              </th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                Data
              </th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <NewsRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild>
            <Link href={buildHref({ status, niche, page: page - 1 })}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} asChild>
            <Link href={buildHref({ status, niche, page: page + 1 })}>
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleCompose = async () => {
    setComposing(true);
    try {
      await fetch(`/api/news/${item.id}/compose`, { method: 'POST' });
    } finally {
      setComposing(false);
      router.refresh();
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await fetch(`/api/news/${item.id}/publish`, { method: 'POST' });
    } finally {
      setPublishing(false);
      router.refresh();
    }
  };

  const raw = item.published_at ?? item.created_at;
  const d = new Date(raw);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const canCompose =
    (item.status === 'curated' || item.status === 'scraped' || item.status === 'failed') &&
    Boolean(item.cover_image_r2_key || item.cover_image_url);

  const canPublish = item.status === 'story_composed';

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 max-w-xs">
        <p className="font-medium line-clamp-2 leading-snug">{item.title}</p>
        {item.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {item.summary}
          </p>
        )}
        {item.error_message && (
          <p className="text-xs text-red-500 mt-1 line-clamp-1">
            {item.error_message}
          </p>
        )}
      </td>

      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-xs text-muted-foreground">{item.source_name}</span>
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={item.status as NewsStatus} />
      </td>

      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground">{date}</span>
        <span className="text-xs text-muted-foreground/60 ml-1">{time}</span>
      </td>

      <td className="px-4 py-3">
        <div className="flex gap-1 justify-end items-center">
          {/* Link to original article */}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" title="Abrir notícia original">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>

          {/* Compose story art */}
          {canCompose && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleCompose}
              disabled={composing}
              title="Gerar story art"
            >
              {composing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {/* Publish to Instagram */}
          {canPublish && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handlePublish}
              disabled={publishing}
              title="Publicar no Instagram"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {/* Preview story art */}
          {item.story_art_r2_key && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
              <a
                href={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${item.story_art_r2_key}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver story art"
              >
                <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
              </a>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: NewsStatus }) {
  const map: Record<NewsStatus, { label: string; className: string }> = {
    discovered: {
      label: 'Descoberta',
      className: 'border-border text-muted-foreground',
    },
    scraped: {
      label: 'Raspada',
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    },
    curated: {
      label: 'Curada',
      className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    },
    rejected: {
      label: 'Rejeitada',
      className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
    },
    story_composed: {
      label: 'Story Pronto',
      className: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    },
    published: {
      label: 'Publicada',
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    },
    failed: {
      label: 'Falhou',
      className: 'bg-red-500/10 text-red-600 border-red-500/30',
    },
  };
  const { label, className } = map[status] ?? {
    label: status,
    className: '',
  };
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

function buildHref(params: { status?: NewsStatus; niche?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.niche && params.niche !== 'beach-tennis') sp.set('niche', params.niche);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return `/admin/news${qs ? `?${qs}` : ''}`;
}
