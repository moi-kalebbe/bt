import { Suspense } from 'react';
import { findNewsItems } from '@/infra/supabase/repositories/news.repository';
import { NewsList } from './news-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Sparkles } from 'lucide-react';
import { NICHES } from '@/config/niches';
import type { NewsStatus } from '@/types/domain';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string; niche?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status as NewsStatus | undefined;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const niche = params.niche ?? 'beach-tennis';
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await findNewsItems({ status, niche, limit, offset });

  const nicheLabel = NICHES.find((n) => n.id === niche)?.label ?? niche;

  function buildHref(s: string) {
    const p = new URLSearchParams();
    if (s) p.set('status', s);
    if (niche !== 'beach-tennis') p.set('niche', niche);
    const qs = p.toString();
    return `/admin/news${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notícias — {nicheLabel}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} {total === 1 ? 'notícia' : 'notícias'} encontradas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter links */}
          {(
            ['', 'discovered', 'scraped', 'curated', 'rejected', 'story_composed', 'published', 'failed'] as const
          ).map((s) => {
            const label =
              s === ''             ? 'Todas'
              : s === 'discovered' ? 'Descobertas'
              : s === 'scraped'    ? 'Raspadas'
              : s === 'curated'    ? 'Curadas'
              : s === 'rejected'   ? 'Rejeitadas'
              : s === 'story_composed' ? 'Story Pronto'
              : s === 'published'  ? 'Publicadas'
              : 'Falhas';
            const href = buildHref(s);
            const active = (status ?? '') === s;
            return (
              <a
                key={s}
                href={href}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {label}
              </a>
            );
          })}

          <form action="/api/news/curate" method="POST">
            <input type="hidden" name="niche" value={niche} />
            <Button type="submit" variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Curar
            </Button>
          </form>

          <form action="/api/news/fetch" method="POST">
            <input type="hidden" name="niche" value={niche} />
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Buscar Notícias
            </Button>
          </form>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <NewsList
          items={items}
          total={total}
          page={page}
          limit={limit}
          status={status}
          niche={niche}
        />
      </Suspense>
    </div>
  );
}
