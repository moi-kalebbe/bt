const ZERNIO_BASE = 'https://zernio.com/api/v1';

export type ZernioPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube';

export async function zernioPost(
  platform: ZernioPlatform,
  mediaUrl: string,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'ZERNIO_API_KEY not configured' };
  }

  const res = await fetch(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content: caption,
      platform,
      media_urls: mediaUrl,
      publish_now: true,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    return {
      success: false,
      error: data.error?.message ?? data.message ?? `HTTP ${res.status}`,
    };
  }

  return { success: true, postId: data.id ?? data.post_id };
}
