import { Suspense } from 'react';
import { findContents } from '@/infra/supabase/repositories/content.repository';
import { selectAndScheduleVideos } from '@/services/schedule.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Sun, Moon } from 'lucide-react';
import { normalizeStatusLabel, getSlotEmoji, getSlotLabel } from '@/domain/content';
import type { Slot } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const { items: morningVideos } = await findContents({
    status: 'scheduled',
    limit: 10,
    offset: 0,
  });

  const morningContent = morningVideos.find((v) => v.selected_for_slot === 'morning');
  const nightContent = morningVideos.find((v) => v.selected_for_slot === 'night');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-bold">Beach Tennis Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Agendamento de conteúdo
            </p>
          </div>
          <div className="flex gap-2">
            <form action="/api/schedule" method="POST">
              <Button type="submit">
                <Play className="mr-2 h-4 w-4" />
                Rodar Scheduler
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-2">
          <SlotCard
            slot="morning"
            icon={<Sun className="h-8 w-8 text-yellow-500" />}
            title="Vídeo da Manhã"
            description="Será publicado às 8h"
            content={morningContent}
          />

          <SlotCard
            slot="night"
            icon={<Moon className="h-8 w-8 text-blue-500" />}
            title="Vídeo da Noite"
            description="Será publicado às 18h"
            content={nightContent}
          />
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Vídeos Agendados</h2>
          <div className="rounded-lg border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Slot</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Título</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Autor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {morningContent && (
                  <tr className="border-b">
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        <Sun className="mr-1 h-3 w-3" />
                        Manhã
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{morningContent.title ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">@{morningContent.author_username}</td>
                    <td className="px-4 py-3">
                      <Badge>{normalizeStatusLabel(morningContent.status as import('@/types/domain').ContentStatus)}</Badge>
                    </td>
                  </tr>
                )}
                {nightContent && (
                  <tr className="border-b">
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        <Moon className="mr-1 h-3 w-3" />
                        Noite
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{nightContent.title ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">@{nightContent.author_username}</td>
                    <td className="px-4 py-3">
                      <Badge>{normalizeStatusLabel(nightContent.status as import('@/types/domain').ContentStatus)}</Badge>
                    </td>
                  </tr>
                )}
                {!morningContent && !nightContent && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum vídeo agendado. Clique em "Rodar Scheduler" para selecionar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function SlotCard({
  slot,
  icon,
  title,
  description,
  content,
}: {
  slot: Slot;
  icon: React.ReactNode;
  title: string;
  description: string;
  content: import('@/types/domain').ContentItem | undefined;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        {icon}
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardHeader>
      <CardContent>
        {content ? (
          <div className="space-y-2">
            <p className="font-medium">{content.title ?? 'Sem título'}</p>
            <p className="text-sm text-muted-foreground">
              @{content.author_username}
            </p>
            {content.hashtags && content.hashtags.length > 0 && (
              <p className="text-xs text-muted-foreground">
                #{content.hashtags.slice(0, 5).join(' #')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhum vídeo selecionado</p>
        )}
      </CardContent>
    </Card>
  );
}
