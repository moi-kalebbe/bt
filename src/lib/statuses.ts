import type { ContentStatus } from '@/types/domain';

export const CONTENT_STATUSES: ContentStatus[] = [
  'discovered',
  'filtered_out',
  'downloaded',
  'uploaded_r2',
  'ready',
  'scheduled',
  'processing',
  'published',
  'failed',
  'ignored_duplicate',
];
