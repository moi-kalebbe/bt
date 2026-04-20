import { findContents, countByStatus } from '@/infra/supabase/repositories/content.repository';
import { getWeeklySchedule } from '@/infra/supabase/repositories/publish-jobs.repository';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Play, CheckCircle2, Clock, TrendingUp, Activity } from 'lucide-react';
import { NICHES } from '@/config/niches';
import { SlotCardEnhanced } from './slot-card-enhanced';
import { ScheduleList } from './schedule-list';
import type { Slot } from '@/types/domain';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ niche?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const niche = params.niche ?? 'beach-tennis';
  const nicheLabel = NICHES.find((n) => n.id === niche)?.label ?? niche;

  const [{ items: scheduledVideos }, stats, weeklySchedule] = await Promise.all([
    findContents({ status: 'scheduled', niche, limit: 100, offset: 0 }),
    countByStatus(niche),
    getWeeklySchedule(niche, 7),
  ]);

  const slots: Record<Slot, (typeof scheduledVideos)[0] | undefined> = {
    morning: scheduledVideos.find((v) => v.selected_for_slot === 'morning'),
    midday: scheduledVideos.find((v) => v.selected_for_slot === 'midday'),
    evening: scheduledVideos.find((v) => v.selected_for_slot === 'evening'),
    night: scheduledVideos.find((v) => v.selected_for_slot === 'night'),
  };

  const filledSlots = Object.values(slots).filter(Boolean).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Agendamento — {nicheLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {filledSlots} de 4 slots preenchidos para o próximo ciclo
          </p>
        </div>
        <form action="/api/schedule" method="POST">
          <input type="hidden" name="niche" value={niche} />
          <Button type="submit">
            <Play className="mr-2 h-4 w-4" />
            Rodar Scheduler
          </Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="No Pipeline"
          value={stats.pipeline}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          description="Descobertos, baixados e prontos"
        />
        <StatCard
          title="Prontos"
          value={stats.ready}
          icon={<CheckCircle2 className="h-4 w-4 text-blue-500" />}
          description="Aguardando agendamento"
          valueClass="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Agendados"
          value={stats.scheduled}
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
          description="Selecionados para publicar"
          valueClass="text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          title="Publicados Hoje"
          value={stats.publishedToday}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          description="No Instagram hoje"
          valueClass="text-green-600 dark:text-green-400"
        />
      </div>

      <Separator />

      {/* Slot Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Próximas Publicações</h2>
          <span className="text-xs text-muted-foreground">
            {filledSlots}/4 slots
          </span>
        </div>

        {/* Pipeline progress bar */}
        <div className="mb-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(filledSlots / 4) * 100}%` }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SlotCardEnhanced slot="morning" content={slots.morning} />
          <SlotCardEnhanced slot="midday" content={slots.midday} />
          <SlotCardEnhanced slot="evening" content={slots.evening} />
          <SlotCardEnhanced slot="night" content={slots.night} />
        </div>
      </div>

      <Separator />

      {/* Calendar + List */}
      <ScheduleList weeklySchedule={weeklySchedule} />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  valueClass = '',
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          {icon}
        </div>
        <p className={`text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </CardContent>
    </Card>
  );
}
