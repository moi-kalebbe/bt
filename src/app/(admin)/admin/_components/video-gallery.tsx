import Link from 'next/link';
import { findContents } from '@/infra/supabase/repositories/content.repository';
import { findMetricsByContentIds } from '@/infra/supabase/repositories/instagram-metrics.repository';
import { scoreContentItem } from '@/lib/scoring';
import { VideoCard } from './video-card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ContentStatus, Slot } from '@/types/domain';

type SortBy = 'score' | 'newest' | 'oldest';

interface VideoGalleryProps {
  source?: string;
  status?: ContentStatus;
  author?: string;
  slot?: Slot;
  niche?: string;
  limit: number;
  offset: number;
  page: number;
  sortBy?: SortBy;
}

export async function VideoGallery({
  source,
  status,
  author,
  slot,
  niche,
  limit,
  offset,
  page,
  sortBy,
}: VideoGalleryProps) {
  let { items, total } = await findContents({
    source: source || undefined,
    status,
    authorUsername: author || undefined,
    selectedForSlot: slot,
    niche: niche || undefined,
    limit,
    offset,
    sortBy,
  });

  // Score all items (cheap — pure math on raw_payload already in memory)
  const scored = items.map((item) => ({ item, score: scoreContentItem(item).total }));

  // Fetch Instagram metrics for published videos in one query
  const publishedIds = items.filter((i) => i.published_to_instagram).map((i) => i.id);
  const igMetrics = await findMetricsByContentIds(publishedIds);

  if (sortBy === 'score') {
    // Sort by engagement score descending, then paginate in memory
    scored.sort((a, b) => b.score - a.score);
    total = scored.length;
    scored.splice(0, offset);
    scored.splice(limit);
  }

  const totalPages = Math.ceil(total / limit);

  if (scored.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">🎾</div>
        <h3 className="text-lg font-semibold">Nenhum vídeo encontrado</h3>
        <p className="text-muted-foreground mt-1">
          Tente ajustar os filtros ou executar uma nova coleta
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} vídeo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {scored.map(({ item, score }) => (
          <VideoCard
            key={item.id}
            video={item}
            score={score}
            igMetrics={igMetrics.get(item.id)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            asChild
          >
            <Link
              href={`/admin?${buildQueryString({ source, status, author, slot, niche, sortBy, page: page - 1 })}`}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild
          >
            <Link
              href={`/admin?${buildQueryString({ source, status, author, slot, niche, sortBy, page: page + 1 })}`}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function buildQueryString(params: {
  source?: string;
  status?: ContentStatus;
  author?: string;
  slot?: Slot;
  niche?: string;
  sortBy?: SortBy;
  page?: number;
}): string {
  const searchParams = new URLSearchParams();
  if (params.source) searchParams.set('source', params.source);
  if (params.status) searchParams.set('status', params.status);
  if (params.author) searchParams.set('author', params.author);
  if (params.slot) searchParams.set('slot', params.slot);
  if (params.niche && params.niche !== 'beach-tennis') searchParams.set('niche', params.niche);
  if (params.sortBy && params.sortBy !== 'newest') searchParams.set('sort', params.sortBy);
  if (params.page && params.page > 1) searchParams.set('page', String(params.page));
  return searchParams.toString();
}
