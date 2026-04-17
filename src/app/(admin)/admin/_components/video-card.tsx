'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sun, Moon, ExternalLink, Send, Loader2, Check, X, Trash2 } from 'lucide-react';
import { normalizeStatusLabel, getSlotEmoji, getSlotLabel } from '@/domain/content';
import type { ContentItem } from '@/types/domain';
import type { InstagramMetrics } from '@/infra/supabase/repositories/instagram-metrics.repository';

interface VideoCardProps {
  video: ContentItem;
  score?: number;
  igMetrics?: InstagramMetrics;
}

export function VideoCard({ video, score, igMetrics }: VideoCardProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<'success' | 'error' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const needsProcessing = !video.processed_video_r2_key && !!video.original_video_r2_key;

  let extractedUrl: string | null = null;
  let extractedVideoUrl: string | null = null;
  if (video.raw_payload) {
    const raw = video.raw_payload as any;
    if (video.source === 'tiktok') {
      if (!video.thumbnail_original_url) {
        extractedUrl = raw.thumbnailUrl ?? raw.covers?.[0]?.url ?? raw.videoMeta?.coverUrl ?? raw.videoMeta?.originalCoverUrl ?? null;
      }
      extractedVideoUrl = raw.videoUrl ?? raw.downloadAddr ?? raw.playAddr ?? raw.videoMeta?.downloadAddr ?? raw.videoMeta?.playAddr ?? null;
    } else if (video.source === 'youtube') {
      if (!video.thumbnail_original_url) {
        extractedUrl = raw.thumbnailUrl ?? raw.bestThumbnail?.url ?? null;
      }
      extractedVideoUrl = raw.videoUrl ?? null;
    }
  }

  const thumbnailUrl = video.thumbnail_original_url ?? extractedUrl ?? (video.thumbnail_r2_key
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${video.thumbnail_r2_key}`
    : null);

  const videoUrl = video.original_video_r2_key
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${video.original_video_r2_key}`
    : extractedVideoUrl;

  const handlePublishNow = async () => {
    setPublishing(true);
    setPublishResult(null);
    try {
      const response = await fetch(`/api/videos/${video.id}/publish`, { method: 'POST' });
      setPublishResult(response.ok ? 'success' : 'error');
      if (response.ok) router.refresh();
    } catch {
      setPublishResult('error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Deletar este vídeo permanentemente?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleSchedule = async (slot: 'morning' | 'night') => {
    try {
      const response = await fetch(`/api/videos/${video.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Error scheduling video:', error);
    }
  };

  const displayHashtags = (video.hashtags || [])
    .map((h: any) => typeof h === 'string' ? h : h?.name || h?.text || '')
    .filter(Boolean);

  const raw = video.raw_payload as Record<string, unknown> | null;
  const rawViews  = raw ? Number(raw.playCount  ?? raw.viewCount  ?? 0) : 0;
  const rawLikes  = raw ? Number(raw.diggCount  ?? raw.likeCount  ?? 0) : 0;
  const rawShares = raw ? Number(raw.shareCount ?? 0) : 0;

  const isFinished = video.status === 'published' || video.status === 'ignored_duplicate' || video.status === 'failed';

  function getStatusStyles(status: string) {
    switch (status) {
      case 'published':
        return 'border-green-500 bg-emerald-500/10 text-green-600 hover:bg-emerald-500/20 px-2 py-0.5 shadow-sm font-bold';
      case 'failed':
        return 'border-red-500 bg-red-500/10 text-red-600 hover:bg-red-500/20 font-bold';
      case 'scheduled':
        return 'border-yellow-500 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 font-bold';
      case 'ready':
        return 'border-blue-500 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-bold';
      default:
        return 'bg-background hover:bg-muted font-bold';
    }
  }

  return (
    <div className={`group overflow-hidden rounded-lg border bg-card transition-all duration-300 ${isFinished ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}>
      <div className="relative aspect-[9/16] overflow-hidden bg-muted">
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={video.title ?? 'Video thumbnail'}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : videoUrl && !videoError ? (
          <video
            src={videoUrl}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            muted
            playsInline
            loop
            preload="metadata"
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-4xl">🎾</span>
          </div>
        )}

        <div className="absolute left-2 top-2 z-10">
          <Badge variant="outline" className={getStatusStyles(video.status)}>
            {normalizeStatusLabel(video.status as import('@/types/domain').ContentStatus)}
          </Badge>
        </div>

        {video.selected_for_slot ? (
          <div className="absolute right-2 top-2">
            <Badge variant="secondary">
              {getSlotEmoji(video.selected_for_slot)} {getSlotLabel(video.selected_for_slot)}
            </Badge>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="absolute right-2 top-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDelete}
            disabled={deleting}
            title="Deletar vídeo"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        )}

        {video.duration_seconds && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
            {formatDuration(video.duration_seconds)}
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate">
            @{video.author_username ?? 'unknown'}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            {video.source}
          </Badge>
          {score !== undefined && score > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0 ml-auto font-mono">
              ⚡{score}
            </Badge>
          )}
        </div>

        {rawViews > 0 && (
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span title="Views">👁 {formatNum(rawViews)}</span>
            {rawLikes > 0 && <span title="Curtidas">❤️ {formatNum(rawLikes)}</span>}
            {rawShares > 0 && <span title="Compartilhamentos">🔁 {formatNum(rawShares)}</span>}
          </div>
        )}

        {igMetrics && (
          <div className="mb-1 rounded bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">
              <span>📊 Instagram</span>
              {igMetrics.engagement_rate != null && (
                <span className="ml-auto font-mono">
                  {(Number(igMetrics.engagement_rate) * 100).toFixed(1)}% eng.
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
              {igMetrics.reach != null && <span>👥 {formatNum(igMetrics.reach)} alcance</span>}
              {igMetrics.plays != null && igMetrics.plays > 0 && <span>▶️ {formatNum(igMetrics.plays)} plays</span>}
              {igMetrics.likes != null && igMetrics.likes > 0 && <span>❤️ {formatNum(igMetrics.likes)}</span>}
              {igMetrics.shares != null && igMetrics.shares > 0 && <span>🔁 {formatNum(igMetrics.shares)}</span>}
              {igMetrics.saves != null && igMetrics.saves > 0 && <span>🔖 {formatNum(igMetrics.saves)}</span>}
            </div>
          </div>
        )}

        {video.title && (
          <h3 className="line-clamp-2 text-sm font-medium">{video.title}</h3>
        )}

        {displayHashtags.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            #{displayHashtags.slice(0, 3).join(' #')}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          {video.source_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 flex-1"
              asChild
            >
              <a
                href={video.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Ver
              </a>
            </Button>
          )}

          {video.status === 'ready' && !video.selected_for_slot && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => handleSchedule('morning')}
              >
                <Sun className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => handleSchedule('night')}
              >
                <Moon className="h-3 w-3" />
              </Button>
            </>
          )}

          {(video.status === 'scheduled' || (video.status === 'ready' && video.processed_video_r2_key)) && (
            <Button
              variant="outline"
              size="sm"
              className={`h-8 flex-1 ${publishResult === 'success' ? 'border-green-500 text-green-600' : publishResult === 'error' ? 'border-red-500 text-red-600' : ''}`}
              onClick={handlePublishNow}
              disabled={publishing}
            >
              {publishing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : publishResult === 'success' ? (
                <Check className="h-3 w-3" />
              ) : publishResult === 'error' ? (
                <X className="h-3 w-3" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              <span className="ml-1">
                {publishing
                  ? (needsProcessing ? 'Processando...' : 'Publicando...')
                  : publishResult === 'success' ? 'Publicado!'
                  : publishResult === 'error' ? 'Erro'
                  : needsProcessing ? 'Processar e Publicar' : 'Publicar'}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
