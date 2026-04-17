import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Coffee, Sun, Sunset, Moon, ExternalLink, Clock } from 'lucide-react';
import { UnscheduleButton } from './unschedule-button';
import { VideoPreview } from './video-preview';
import { getMediaUrls } from './media-utils';
import type { ContentItem, Slot } from '@/types/domain';

const SLOT_CONFIG = {
  morning: {
    Icon: Coffee,
    iconClass: 'text-yellow-500',
    borderClass: 'border-yellow-500/30 bg-yellow-500/5',
    label: 'Manhã',
    time: '08:00',
  },
  midday: {
    Icon: Sun,
    iconClass: 'text-orange-500',
    borderClass: 'border-orange-500/30 bg-orange-500/5',
    label: 'Meio-dia',
    time: '11:30',
  },
  evening: {
    Icon: Sunset,
    iconClass: 'text-rose-500',
    borderClass: 'border-rose-500/30 bg-rose-500/5',
    label: 'Tarde',
    time: '18:00',
  },
  night: {
    Icon: Moon,
    iconClass: 'text-blue-500',
    borderClass: 'border-blue-500/30 bg-blue-500/5',
    label: 'Noite',
    time: '21:30',
  },
} satisfies Record<Slot, { Icon: React.ElementType; iconClass: string; borderClass: string; label: string; time: string }>;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SlotCardEnhancedProps {
  slot: Slot;
  content: ContentItem | undefined;
}

export function SlotCardEnhanced({ slot, content }: SlotCardEnhancedProps) {
  const { Icon, iconClass, borderClass, label, time } = SLOT_CONFIG[slot];
  const media = content ? getMediaUrls(content) : null;

  return (
    <Card className={`overflow-hidden transition-all ${content ? borderClass : 'border-dashed opacity-60'}`}>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconClass}`} />
            <div>
              <p className="text-sm font-semibold leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {time}
              </p>
            </div>
          </div>
          {content && (
            <Badge variant="outline" className="text-xs capitalize">
              {content.source}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        {content && media ? (
          <div className="space-y-2">
            <div className="relative aspect-video rounded-md overflow-hidden">
              <VideoPreview
                thumbnailUrl={media.thumbnailUrl}
                videoUrl={media.videoUrl}
                alt={content.title ?? 'Vídeo'}
                className="h-full w-full"
              />
              {content.duration_seconds && (
                <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-xs text-white">
                  {formatDuration(content.duration_seconds)}
                </div>
              )}
            </div>

            <div className="space-y-0.5">
              <p className="line-clamp-2 text-xs font-medium leading-tight">
                {content.title ?? 'Sem título'}
              </p>
              <p className="text-xs text-muted-foreground">@{content.author_username}</p>
            </div>

            <div className="flex gap-1.5 pt-0.5">
              {content.source_url && (
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" asChild>
                  <a href={content.source_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Ver Vídeo
                  </a>
                </Button>
              )}
              <UnscheduleButton videoId={content.id} size="icon" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-1">
            <div className="text-3xl opacity-20">—</div>
            <p className="text-sm text-muted-foreground">Vazio</p>
            <p className="text-xs text-muted-foreground/60">Nenhum vídeo agendado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
