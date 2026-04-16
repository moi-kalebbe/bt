import { format } from 'date-fns';

export type Source = 'tiktok' | 'youtube' | 'instagram' | 'facebook';
export type MediaType = 'video' | 'thumbnail' | 'track';

export function buildRawVideoPath(
  source: Source,
  date: Date,
  contentId: string
): string {
  const dateStr = format(date, 'yyyy/MM/dd');
  return `raw/${source}/${dateStr}/${contentId}.mp4`;
}

export function buildProcessedVideoPath(
  date: Date,
  contentId: string
): string {
  const dateStr = format(date, 'yyyy/MM/dd');
  return `processed/${dateStr}/${contentId}.mp4`;
}

export function buildThumbnailPath(
  source: Source,
  date: Date,
  contentId: string
): string {
  const dateStr = format(date, 'yyyy/MM/dd');
  return `thumbs/${source}/${dateStr}/${contentId}.jpg`;
}

export function buildTrackPath(trackId: string): string {
  return `tracks/${trackId}.mp3`;
}

export function buildNewsImagePath(date: Date, newsId: string): string {
  const dateStr = format(date, 'yyyy/MM/dd');
  return `news/covers/${dateStr}/${newsId}.jpg`;
}

export function buildNewsStoryPath(date: Date, newsId: string): string {
  const dateStr = format(date, 'yyyy/MM/dd');
  return `news/stories/${dateStr}/${newsId}.jpg`;
}

export function parseR2Key(key: string): {
  type: MediaType;
  source?: Source;
  date?: Date;
  id: string;
} | null {
  const parts = key.split('/');

  if (parts[0] === 'raw' && parts.length >= 4) {
    const source = parts[1] as Source;
    const dateParts = parts[2].split('/');
    if (dateParts.length === 3) {
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      );
      const id = parts[3].replace('.mp4', '');
      return { type: 'video', source, date, id };
    }
  }

  if (parts[0] === 'processed' && parts.length >= 3) {
    const dateParts = parts[1].split('/');
    if (dateParts.length === 3) {
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      );
      const id = parts[2].replace('.mp4', '');
      return { type: 'video', date, id };
    }
  }

  if (parts[0] === 'thumbs' && parts.length >= 4) {
    const source = parts[1] as Source;
    const dateParts = parts[2].split('/');
    if (dateParts.length === 3) {
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      );
      const id = parts[3].replace('.jpg', '');
      return { type: 'thumbnail', source, date, id };
    }
  }

  if (parts[0] === 'tracks' && parts.length >= 2) {
    const id = parts[1].replace('.mp3', '');
    return { type: 'track', id };
  }

  return null;
}
