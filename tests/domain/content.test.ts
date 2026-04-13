import { describe, it, expect } from 'vitest';
import {
  isBlockedAuthor,
  computeContentHash,
  canTransitionTo,
  normalizeStatusLabel,
} from '@/domain/content';
import type { NormalizedContent } from '@/types/domain';

describe('Content Domain', () => {
  describe('isBlockedAuthor', () => {
    it('should block btrobson on tiktok', () => {
      expect(isBlockedAuthor('btrobson', 'tiktok')).toBe(true);
      expect(isBlockedAuthor('@btrobson', 'tiktok')).toBe(true);
      expect(isBlockedAuthor('BTROBSON', 'tiktok')).toBe(true);
    });

    it('should block raphael.bt on youtube', () => {
      expect(isBlockedAuthor('raphael.bt', 'youtube')).toBe(true);
      expect(isBlockedAuthor('@raphael.bt', 'youtube')).toBe(true);
    });

    it('should not block other authors', () => {
      expect(isBlockedAuthor('beachtennispro', 'tiktok')).toBe(false);
      expect(isBlockedAuthor(null, 'tiktok')).toBe(false);
      expect(isBlockedAuthor(undefined, 'youtube')).toBe(false);
    });
  });

  describe('computeContentHash', () => {
    it('should compute same hash for same content', () => {
      const content1: NormalizedContent = {
        source: 'tiktok',
        sourceVideoId: '123',
        sourceUrl: 'https://tiktok.com/@user/video/123',
        authorUsername: 'user',
        authorDisplayName: 'User',
        title: 'Test video',
        description: 'Test description',
        hashtags: ['beachtennis'],
        publishedAtSource: '2024-01-01',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        durationSeconds: 30,
        rawPayload: {},
      };

      const content2: NormalizedContent = { ...content1 };

      expect(computeContentHash(content1)).toBe(computeContentHash(content2));
    });

    it('should compute different hash for different content', () => {
      const content1: NormalizedContent = {
        source: 'tiktok',
        sourceVideoId: '123',
        sourceUrl: 'https://tiktok.com/@user/video/123',
        authorUsername: 'user',
        authorDisplayName: 'User',
        title: 'Test video',
        description: 'Test description',
        hashtags: ['beachtennis'],
        publishedAtSource: '2024-01-01',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        durationSeconds: 30,
        rawPayload: {},
      };

      const content2: NormalizedContent = {
        ...content1,
        sourceVideoId: '456',
      };

      expect(computeContentHash(content1)).not.toBe(computeContentHash(content2));
    });
  });

  describe('canTransitionTo', () => {
    it('should allow valid transitions', () => {
      expect(canTransitionTo('discovered', 'downloaded')).toBe(true);
      expect(canTransitionTo('downloaded', 'uploaded_r2')).toBe(true);
      expect(canTransitionTo('uploaded_r2', 'ready')).toBe(true);
      expect(canTransitionTo('ready', 'scheduled')).toBe(true);
      expect(canTransitionTo('scheduled', 'processing')).toBe(true);
      expect(canTransitionTo('processing', 'published')).toBe(true);
    });

    it('should not allow invalid transitions', () => {
      expect(canTransitionTo('discovered', 'published')).toBe(false);
      expect(canTransitionTo('published', 'ready')).toBe(false);
      expect(canTransitionTo('filtered_out', 'downloaded')).toBe(false);
    });

    it('should allow retry from failed', () => {
      expect(canTransitionTo('failed', 'ready')).toBe(true);
    });
  });

  describe('normalizeStatusLabel', () => {
    it('should return correct labels in Portuguese', () => {
      expect(normalizeStatusLabel('discovered')).toBe('Descoberto');
      expect(normalizeStatusLabel('filtered_out')).toBe('Filtrado');
      expect(normalizeStatusLabel('downloaded')).toBe('Baixado');
      expect(normalizeStatusLabel('ready')).toBe('Pronto');
      expect(normalizeStatusLabel('published')).toBe('Publicado');
      expect(normalizeStatusLabel('failed')).toBe('Falhou');
    });
  });
});
