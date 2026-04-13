import type {
  ContentSource,
  ContentStatus,
  NormalizedContent,
  Slot,
} from '@/types/domain';
import { createHash } from 'crypto';

export const BLOCKED_AUTHORS: Record<ContentSource, string[]> = {
  tiktok: ['btrobson', 'raphael.bt'],
  youtube: ['btrobson', 'raphael.bt'],
};

export function isBlockedAuthor(
  username: string | null | undefined,
  source: ContentSource
): boolean {
  if (!username) return false;
  const normalized = username.toLowerCase().replace('@', '').trim();
  return BLOCKED_AUTHORS[source].includes(normalized);
}

export function computeContentHash(item: NormalizedContent): string {
  const parts = [
    item.source,
    item.sourceVideoId,
    item.authorUsername ?? '',
    item.title ?? '',
  ]
    .filter(Boolean)
    .join('|');

  return createHash('sha256').update(parts).digest('hex').slice(0, 16);
}

const VALID_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  discovered: ['filtered_out', 'downloaded', 'failed'],
  filtered_out: [],
  downloaded: ['uploaded_r2', 'failed'],
  uploaded_r2: ['ready', 'failed'],
  ready: ['scheduled', 'processing', 'failed'],
  scheduled: ['processing', 'failed'],
  processing: ['published', 'failed'],
  published: [],
  failed: ['discovered', 'ready'],
  ignored_duplicate: [],
};

export function canTransitionTo(
  currentStatus: ContentStatus,
  targetStatus: ContentStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export function normalizeStatusLabel(status: ContentStatus): string {
  const labels: Record<ContentStatus, string> = {
    discovered: 'Descoberto',
    filtered_out: 'Filtrado',
    downloaded: 'Baixado',
    uploaded_r2: 'No R2',
    ready: 'Pronto',
    scheduled: 'Agendado',
    processing: 'Processando',
    published: 'Publicado',
    failed: 'Falhou',
    ignored_duplicate: 'Duplicado',
  };
  return labels[status] ?? status;
}

export function getSlotLabel(slot: Slot): string {
  return slot === 'morning' ? 'Manhã' : 'Noite';
}

export function getSlotEmoji(slot: Slot): string {
  return slot === 'morning' ? '🌅' : '🌙';
}
