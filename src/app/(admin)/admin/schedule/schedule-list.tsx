import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coffee, Sun, Sunset, Moon, ExternalLink, CalendarDays } from 'lucide-react';
import { UnscheduleButton } from './unschedule-button';
import { VideoPreview } from './video-preview';
import { getMediaUrls } from './media-utils';
import type { ContentItem, Slot } from '@/types/domain';

const SLOT_CONFIG = {
  morning: { Icon: Coffee, colorClass: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30', label: 'Manhã', time: '08:00' },
  midday:  { Icon: Sun,    colorClass: 'text-orange-600 bg-orange-500/10 border-orange-500/30', label: 'Meio-dia', time: '11:30' },
  evening: { Icon: Sunset, colorClass: 'text-rose-600 bg-rose-500/10 border-rose-500/30',       label: 'Tarde', time: '18:00' },
  night:   { Icon: Moon,   colorClass: 'text-blue-600 bg-blue-500/10 border-blue-500/30',       label: 'Noite', time: '21:30' },
} satisfies Record<Slot, { Icon: React.ElementType; colorClass: string; label: string; time: string }>;

const ALL_SLOTS: Slot[] = ['morning', 'midday', 'evening', 'night'];

const SLOT_HOURS: Record<Slot, [number, number]> = {
  morning: [8,  0],
  midday:  [11, 30],
  evening: [18, 0],
  night:   [21, 30],
};

function getNextSlotDate(slot: Slot): string {
  const [hour, minute] = SLOT_HOURS[slot];
  const now = new Date();
  const slotTime = new Date(now);
  slotTime.setHours(hour, minute, 0, 0);
  if (slotTime <= now) slotTime.setDate(slotTime.getDate() + 1);
  return format(slotTime, 'yyyy-MM-dd');
}

function getDateLabel(dateKey: string): string {
  const date = new Date(dateKey + 'T12:00:00');
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "EEEE, dd/MM", { locale: ptBR });
}

export function ScheduleList({ videos }: { videos: ContentItem[] }) {
  if (videos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground">Nenhum vídeo agendado.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Clique em &ldquo;Rodar Scheduler&rdquo; para selecionar vídeos automaticamente.
        </p>
      </div>
    );
  }

  // Group by next scheduled publication date (derived from slot time, not updated_at)
  const byDate = new Map<string, ContentItem[]>();
  for (const video of videos) {
    const dateKey = video.selected_for_slot
      ? getNextSlotDate(video.selected_for_slot as Slot)
      : format(new Date(video.updated_at), 'yyyy-MM-dd');
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(video);
  }
  const sortedDates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
        <CalendarDays className="h-4 w-4" />
        Calendário de Agendamentos
      </h2>

      <div className="space-y-4">
        {sortedDates.map((dateKey) => {
          const dayVideos = byDate.get(dateKey)!;
          const filledCount = ALL_SLOTS.filter((s) => dayVideos.some((v) => v.selected_for_slot === s)).length;

          return (
            <div key={dateKey} className="rounded-xl border bg-card overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <p className="text-sm font-semibold capitalize">{getDateLabel(dateKey)}</p>
                <Badge variant="outline" className="text-xs">
                  {filledCount}/4 slots
                </Badge>
              </div>

              {/* Slots grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0">
                {ALL_SLOTS.map((slot) => {
                  const video = dayVideos.find((v) => v.selected_for_slot === slot);
                  const { Icon, colorClass, label, time } = SLOT_CONFIG[slot];
                  const media = video ? getMediaUrls(video) : null;

                  return (
                    <div key={slot} className="flex flex-col">
                      {/* Slot label bar */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border-b ${colorClass}`}>
                        <Icon className="h-3 w-3 shrink-0" />
                        <span>{label}</span>
                        <span className="ml-auto opacity-60">{time}</span>
                      </div>

                      {/* Content */}
                      {video && media ? (
                        <div className="flex flex-col flex-1 group">
                          {/* Thumbnail/Video */}
                          <div className="relative aspect-video overflow-hidden">
                            <VideoPreview
                              thumbnailUrl={media.thumbnailUrl}
                              videoUrl={media.videoUrl}
                              alt={video.title ?? 'Vídeo'}
                              className="h-full w-full transition-transform group-hover:scale-105"
                            />
                          </div>

                          {/* Info + actions */}
                          <div className="flex flex-col gap-1 p-2 flex-1">
                            <p className="text-xs font-medium line-clamp-2 leading-tight">
                              {video.title ?? 'Sem título'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              @{video.author_username}
                            </p>
                            <div className="flex gap-1 mt-auto pt-1">
                              {video.source_url && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" asChild title="Ver original">
                                  <a href={video.source_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              )}
                              <UnscheduleButton videoId={video.id} size="icon" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center opacity-30">
                          <span className="text-lg">—</span>
                          <span className="text-[10px] mt-1">Vazio</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
