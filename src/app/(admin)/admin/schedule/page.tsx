import { Suspense } from 'react';
import { findContents } from '@/infra/supabase/repositories/content.repository';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Sun, Moon, Sunset, Coffee } from 'lucide-react';
import { normalizeStatusLabel, getSlotLabel } from '@/domain/content';
import type { Slot } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const { items: scheduledVideos } = await findContents({
    status: 'scheduled',
    limit: 20,
    offset: 0,
  });

  const morningContent  = scheduledVideos.find((v) => v.selected_for_slot === 'morning');
  const middayContent   = scheduledVideos.find((v) => v.selected_for_slot === 'midday');
  const eveningContent  = scheduledVideos.find((v) => v.selected_for_slot === 'evening');
  const nightContent    = scheduledVideos.find((v) => v.selected_for_slot === 'night');

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agendamento</h1>
          <p className="text-sm text-muted-foreground">Vídeos selecionados para publicação</p>
        </div>
        <form action="/api/schedule" method="POST">
          <Button type="submit">
            <Play className="mr-2 h-4 w-4" />
            Rodar Scheduler
          </Button>
        </form>
      </div>

      {/* Slot cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SlotCard
          slot="morning"
          icon={<Coffee className="h-6 w-6 text-yellow-500" />}
          title="Manhã"
          time="08:00"
          content={morningContent}
        />
        <SlotCard
          slot="midday"
          icon={<Sun className="h-6 w-6 text-orange-500" />}
          title="Meio-dia"
          time="11:30"
          content={middayContent}
        />
        <SlotCard
          slot="evening"
          icon={<Sunset className="h-6 w-6 text-rose-500" />}
          title="Tarde"
          time="18:00"
          content={eveningContent}
        />
        <SlotCard
          slot="night"
          icon={<Moon className="h-6 w-6 text-blue-500" />}
          title="Noite"
          time="21:30"
          content={nightContent}
        />
      </div>

      {/* Table */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Todos os agendados</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Slot</th>
                <th className="px-4 py-3 text-left font-medium">Título</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Autor</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {scheduledVideos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum vídeo agendado. Clique em &ldquo;Rodar Scheduler&rdquo; para selecionar.
                  </td>
                </tr>
              ) : (
                scheduledVideos.map((video) => (
                  <tr key={video.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {video.selected_for_slot && (
                        <Badge variant="secondary">
                          {getSlotLabel(video.selected_for_slot as Slot)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{video.title ?? '-'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      @{video.author_username}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{normalizeStatusLabel(video.status as import('@/types/domain').ContentStatus)}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SlotCard({
  icon,
  title,
  time,
  content,
}: {
  slot: Slot;
  icon: React.ReactNode;
  title: string;
  time: string;
  content: import('@/types/domain').ContentItem | undefined;
}) {
  return (
    <Card className={content ? 'border-primary/40' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{time}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {content ? (
          <div className="space-y-1">
            <p className="text-sm font-medium line-clamp-2">{content.title ?? 'Sem título'}</p>
            <p className="text-xs text-muted-foreground">@{content.author_username}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Vazio</p>
        )}
      </CardContent>
    </Card>
  );
}
