import { Suspense } from 'react';
import { VideoGallery } from '@/app/(admin)/admin/_components/video-gallery';
import { VideoFilters } from '@/app/(admin)/admin/_components/video-filters';
import { MusicList } from '@/app/(admin)/admin/_components/music-list';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminToolbar } from './_components/admin-toolbar';
import type { ContentStatus, Slot } from '@/types/domain';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    source?: string;
    status?: string;
    author?: string;
    slot?: string;
    page?: string;
    niche?: string;
    sort?: string;
  }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const source = params.source ?? '';
  const status = params.status as ContentStatus | undefined;
  const author = params.author ?? '';
  const slot = params.slot as Slot | undefined;
  const page = parseInt(params.page ?? '1', 10);
  const niche = params.niche ?? 'beach-tennis';
  const sort = (params.sort ?? 'newest') as 'score' | 'newest' | 'oldest';
  const limit = 20;
  const offset = (page - 1) * limit;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b bg-card px-4 md:px-6 py-3">
        <AdminToolbar niche={niche} />
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: filters + music — hidden on mobile, toggled via sheet in VideoFilters */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:overflow-y-auto">
          <div className="p-4 flex flex-col gap-6">
            <VideoFilters
              currentSource={source}
              currentStatus={status}
              currentAuthor={author}
              currentSlot={slot}
              currentSort={sort !== 'newest' ? sort : undefined}
            />
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <MusicList />
            </Suspense>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Mobile filter row */}
          <div className="lg:hidden mb-4">
            <VideoFilters
              currentSource={source}
              currentStatus={status}
              currentAuthor={author}
              currentSlot={slot}
              currentSort={sort !== 'newest' ? sort : undefined}
              mobileMode
            />
          </div>

          <Suspense fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[9/16] w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          }>
            <VideoGallery
              source={source}
              status={status}
              author={author}
              slot={slot}
              niche={niche}
              limit={limit}
              offset={offset}
              page={page}
              sortBy={sort}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
