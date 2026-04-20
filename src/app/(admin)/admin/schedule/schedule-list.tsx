import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coffee, Sun, Sunset, Moon, ExternalLink, CalendarDays } from 'lucide-react';
import { UnscheduleButton } from './unschedule-button';
import { VideoPreview } from './video-preview';
import type { WeeklySlot } from '@/infra/supabase/repositories/publish-jobs.repository';
import type { Slot } from '@/types/domain';

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';

const SLOT_CONFIG: Record<Slot, {
  Icon: React.ElementType;
  colorClass: string;
  label: string;
  time: string;
}> = {
  morning: { Icon: Coffee, colorClass: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30', label: 'Manhã',    time: '08:00' },
  midday:  { Icon: Sun,    colorClass: 'text-orange-600 bg-orange-500/10 border-orange-500/30', label: 'Meio-dia', time: '11:30' },
  evening: { Icon: Sunset, colorClass: 'text-rose-600 bg-rose-500/10 border-rose-500/30',       label: 'Tarde',    time: '18:00' },
  night:   { Icon: Moon,   colorClass: 'text-blue-600 bg-blue-500/10 border-blue-500/30',       label: 'Noite',    time: '21:30' },
};

const ALL_SLOTS: Slot[] = ['morning', 'midday', 'evening', 'night'];

const BRT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

// Convert UTC ISO string to Brazil date key (YYYY-MM-DD)
function toBrazilDate(iso: string): string {
  return BRT.format(new Date(iso));
}

// Generate next N day keys in Brazil timezone — safe on any server timezone (UTC/Vercel)
function getNext7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    return BRT.format(d);
  });
}

// Compare date keys directly in BRT — avoids isToday/isTomorrow relying on server local tz
function getDayLabel(dateKey: string): string {
  const todayKey   = BRT.format(new Date());
  const tomorrowMs = Date.now() + 24 * 60 * 60 * 1000;
  const tomorrowKey = BRT.format(new Date(tomorrowMs));

  if (dateKey === todayKey)    return 'Hoje';
  if (dateKey === tomorrowKey) return 'Amanhã';

  // Use BRT noon (-03:00) so date-fns format reads the correct local day
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  return format(date, "EEEE, dd/MM", { locale: ptBR });
}

export function ScheduleList({ weeklySchedule }: { weeklySchedule: WeeklySlot[] }) {
  const days = getNext7Days();

  // Index slots by date + slot for O(1) lookup
  const byDateSlot = new Map<string, WeeklySlot>();
  for (const s of weeklySchedule) {
    const dateKey = toBrazilDate(s.scheduledFor);
    byDateSlot.set(`${dateKey}-${s.slot}`, s);
  }

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
        <CalendarDays className="h-4 w-4" />
        Calendário — próximos 7 dias
      </h2>

      <div className="space-y-4">
        {days.map((dateKey) => {
          const daySlots = ALL_SLOTS.map((slot) => ({
            slot,
            item: byDateSlot.get(`${dateKey}-${slot}`) ?? null,
          }));
          const filledCount = daySlots.filter((s) => s.item).length;

          return (
            <div key={dateKey} className="rounded-xl border bg-card overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <p className="text-sm font-semibold capitalize">{getDayLabel(dateKey)}</p>
                <Badge
                  variant={filledCount === 4 ? 'default' : filledCount > 0 ? 'outline' : 'secondary'}
                  className="text-xs"
                >
                  {filledCount}/4 slots
                </Badge>
              </div>

              {/* Slots grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0">
                {daySlots.map(({ slot, item }) => {
                  const { Icon, colorClass, label, time } = SLOT_CONFIG[slot];
                  const thumbnailUrl = item?.thumbnailR2Key ? `${R2}/${item.thumbnailR2Key}` : null;
                  const videoUrl = item?.processedVideoR2Key
                    ? `${R2}/${item.processedVideoR2Key}`
                    : item?.originalVideoR2Key
                    ? `${R2}/${item.originalVideoR2Key}`
                    : null;

                  return (
                    <div key={slot} className="flex flex-col">
                      {/* Slot label bar */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border-b ${colorClass}`}>
                        <Icon className="h-3 w-3 shrink-0" />
                        <span>{label}</span>
                        <span className="ml-auto opacity-60">{time}</span>
                      </div>

                      {item ? (
                        <div className="flex flex-col flex-1 group">
                          <div className="relative aspect-video overflow-hidden">
                            <VideoPreview
                              thumbnailUrl={thumbnailUrl}
                              videoUrl={videoUrl}
                              alt={item.title ?? 'Vídeo'}
                              className="h-full w-full transition-transform group-hover:scale-105"
                            />
                          </div>
                          <div className="flex flex-col gap-1 p-2 flex-1">
                            <p className="text-xs font-medium line-clamp-2 leading-tight">
                              {item.title ?? 'Sem título'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              @{item.authorUsername ?? '—'}
                            </p>
                            <div className="flex gap-1 mt-auto pt-1">
                              {item.sourceUrl && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" asChild title="Ver original">
                                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              )}
                              <UnscheduleButton videoId={item.contentItemId} size="icon" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center opacity-25">
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
