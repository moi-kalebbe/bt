import { Suspense } from 'react';
import { VideoGallery } from '@/app/(admin)/admin/_components/video-gallery';
import { VideoFilters } from '@/app/(admin)/admin/_components/video-filters';
import { MusicList } from '@/app/(admin)/admin/_components/music-list';
import { Button } from '@/components/ui/button';
import { runScrape } from '@/services/scrape.service';
import { selectAndScheduleVideos } from '@/services/schedule.service';
import { RefreshCw, Play, Music, Download } from 'lucide-react';
import type { ContentStatus, Slot } from '@/types/domain';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    source?: string;
    status?: string;
    author?: string;
    slot?: string;
    page?: string;
  }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const source = params.source ?? '';
  const status = params.status as ContentStatus | undefined;
  const author = params.author ?? '';
  const slot = params.slot as Slot | undefined;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let scrapeResult: Awaited<ReturnType<typeof runScrape>> | null = null;
  let scheduleResult: Awaited<ReturnType<typeof selectAndScheduleVideos>> | null = null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-bold">Beach Tennis Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Gerenciamento de conteúdo
            </p>
          </div>
          <div className="flex gap-2">
            <form action="/api/music/sync" method="POST">
              <Button type="submit" variant="outline" size="sm">
                <Music className="mr-2 h-4 w-4" />
                Sincronizar Músicas
              </Button>
            </form>
            <form action="/api/scrape" method="POST">
              <Button type="submit" variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Coleta
              </Button>
            </form>
            <form action="/api/ingest" method="POST">
              <Button type="submit" variant="secondary" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Ingerir (lote 20)
              </Button>
            </form>
            <form action="/api/schedule" method="POST">
              <Button type="submit" variant="outline" size="sm">
                <Play className="mr-2 h-4 w-4" />
                Agendar
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="w-64 shrink-0 flex flex-col">
            <VideoFilters
              currentSource={source}
              currentStatus={status}
              currentAuthor={author}
              currentSlot={slot}
            />
            <Suspense fallback={<div className="mt-6 text-sm text-muted-foreground">Carregando músicas...</div>}>
              <MusicList />
            </Suspense>
          </aside>
          <div className="flex-1">
            <Suspense fallback={<div>Carregando...</div>}>
              <VideoGallery
                source={source}
                status={status}
                author={author}
                slot={slot}
                limit={limit}
                offset={offset}
                page={page}
              />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
