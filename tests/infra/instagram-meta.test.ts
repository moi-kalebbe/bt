import { describe, expect, it } from 'vitest';
import {
  parseInsightsApiResponse,
  REELS_INSIGHT_METRICS,
} from '@/infra/meta/instagram.client';
import {
  buildContentPublishedUpdate,
  pickInstagramMediaIdFromPublishJobs,
} from '@/infra/supabase/repositories/content.repository';

describe('Instagram Meta integration', () => {
  it('uses only Meta-compatible metrics for reels insights', () => {
    expect(REELS_INSIGHT_METRICS).toBe('reach,likes,comments,shares,saved,views');
  });

  it('parses reels insights and maps views into plays', () => {
    const parsed = parseInsightsApiResponse({
      data: [
        { name: 'reach', values: [{ value: 1200 }] },
        { name: 'likes', values: [{ value: 140 }] },
        { name: 'comments', values: [{ value: 18 }] },
        { name: 'shares', values: [{ value: 9 }] },
        { name: 'saved', values: [{ value: 22 }] },
        { name: 'views', values: [{ value: 3100 }] },
      ],
    });

    expect(parsed).toEqual({
      success: true,
      reach: 1200,
      impressions: null,
      likes: 140,
      comments: 18,
      shares: 9,
      saves: 22,
      videoViews: null,
      plays: 3100,
    });
  });

  it('keeps only numeric Meta ids from Instagram publish jobs during backfill', () => {
    const mediaId = pickInstagramMediaIdFromPublishJobs([
      {
        platform: 'youtube',
        response_payload: { postId: '69e39591798fdc26cb34983c' },
      },
      {
        platform: 'instagram',
        response_payload: { postId: '69e364d720acf2303130a99f' },
      },
      {
        platform: 'instagram',
        response_payload: { postId: '17969490885045092' },
      },
    ]);

    expect(mediaId).toBe('17969490885045092');
  });

  it('requires a Meta media id to mark Instagram content as published', () => {
    expect(() =>
      buildContentPublishedUpdate('instagram', '2026-04-19T12:00:00.000Z')
    ).toThrow(/instagram_media_id/i);

    expect(
      buildContentPublishedUpdate(
        'instagram',
        '2026-04-19T12:00:00.000Z',
        '17969490885045092'
      )
    ).toMatchObject({
      status: 'published',
      published_to_instagram: true,
      published_at_instagram: '2026-04-19T12:00:00.000Z',
      instagram_media_id: '17969490885045092',
    });
  });
});
