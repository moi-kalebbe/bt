import { describe, it, expect } from 'vitest';
import { scoreContent } from '@/lib/scoring';
import type { NormalizedContent } from '@/types/domain';

describe('Scoring', () => {
  it('should score content based on hashtags', () => {
    const lowHashtags: NormalizedContent = {
      source: 'tiktok',
      sourceVideoId: '123',
      sourceUrl: 'https://tiktok.com/@user/video/123',
      authorUsername: 'user',
      authorDisplayName: 'User',
      title: 'Test',
      description: 'Test',
      hashtags: ['beach'],
      publishedAtSource: null,
      thumbnailUrl: null,
      durationSeconds: 30,
      rawPayload: {},
    };

    const highHashtags: NormalizedContent = {
      ...lowHashtags,
      hashtags: ['beach', 'tennis', 'beachtennis', 'sport'],
    };

    expect(scoreContent(highHashtags)).toBeGreaterThan(scoreContent(lowHashtags));
  });

  it('should score short videos higher', () => {
    const shortVideo: NormalizedContent = {
      source: 'tiktok',
      sourceVideoId: '123',
      sourceUrl: 'https://tiktok.com/@user/video/123',
      authorUsername: 'user',
      authorDisplayName: 'User',
      title: 'Test',
      description: 'Test',
      hashtags: [],
      publishedAtSource: null,
      thumbnailUrl: null,
      durationSeconds: 30,
      rawPayload: {},
    };

    const longVideo: NormalizedContent = {
      ...shortVideo,
      durationSeconds: 120,
    };

    expect(scoreContent(shortVideo)).toBeGreaterThan(scoreContent(longVideo));
  });

  it('should score content with longer titles higher', () => {
    const shortTitle: NormalizedContent = {
      source: 'tiktok',
      sourceVideoId: '123',
      sourceUrl: 'https://tiktok.com/@user/video/123',
      authorUsername: 'user',
      authorDisplayName: 'User',
      title: 'Hi',
      description: 'Test',
      hashtags: [],
      publishedAtSource: null,
      thumbnailUrl: null,
      durationSeconds: 30,
      rawPayload: {},
    };

    const longTitle: NormalizedContent = {
      ...shortTitle,
      title: 'This is a very long title that is descriptive',
    };

    expect(scoreContent(longTitle)).toBeGreaterThan(scoreContent(shortTitle));
  });
});
