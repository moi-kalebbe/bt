const ZERNIO_BASE = 'https://zernio.com/api/v1';

export type ZernioPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube';

// Account IDs conectados no Zernio (buscados via GET /accounts)
const ACCOUNT_IDS: Record<ZernioPlatform, string> = {
  instagram: '69dd27347dea335c2be735df',
  tiktok:    '69dd28a87dea335c2be7480e',
  youtube:   '69dd28f97dea335c2be74bbb',
  facebook:  '', // não conectado
};

export interface ZernioResult {
  success: boolean;
  postId?: string;
  error?: string;
  /** true when the account hit its daily post quota — stop retrying today */
  dailyLimitReached?: boolean;
}

export async function zernioPost(
  platform: ZernioPlatform,
  mediaUrl: string,
  caption: string
): Promise<ZernioResult> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) return { success: false, error: 'ZERNIO_API_KEY not configured' };

  const accountId = ACCOUNT_IDS[platform];
  if (!accountId) return { success: false, error: `Platform ${platform} not connected in Zernio` };

  const res = await fetch(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content: caption,
      platforms: [{ platform, accountId }],
      mediaItems: [{ url: mediaUrl, type: 'video' }],
      status: 'published',
      scheduledFor: new Date(Date.now() - 1000).toISOString(), // passado = publica agora
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error ?? data.message ?? `HTTP ${res.status}`;
    const dailyLimitReached = /daily limit/i.test(String(errorMsg));
    return { success: false, error: errorMsg, dailyLimitReached };
  }

  // status pode ser 'published', 'pending' (processando) ou 'failed'
  const postStatus = data.post?.status;
  if (postStatus === 'failed') {
    return { success: false, error: data.message ?? 'Publishing failed' };
  }

  return { success: true, postId: data.post?._id };
}

export async function zernioImagePost(
  platform: ZernioPlatform,
  mediaUrl: string,
  caption: string
): Promise<ZernioResult> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) return { success: false, error: 'ZERNIO_API_KEY not configured' };

  const accountId = ACCOUNT_IDS[platform];
  if (!accountId) return { success: false, error: `Platform ${platform} not connected in Zernio` };

  const res = await fetch(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content: caption,
      platforms: [{ platform, accountId }],
      mediaItems: [{ url: mediaUrl, type: 'image' }],
      status: 'published',
      scheduledFor: new Date(Date.now() - 1000).toISOString(),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error ?? data.message ?? `HTTP ${res.status}`;
    const dailyLimitReached = /daily limit/i.test(String(errorMsg));
    return { success: false, error: errorMsg, dailyLimitReached };
  }

  const postStatus = data.post?.status;
  if (postStatus === 'failed') {
    return { success: false, error: data.message ?? 'Publishing failed' };
  }

  return { success: true, postId: data.post?._id };
}

/** Publica uma imagem como Instagram Story (9:16, desaparece em 24h). */
export async function zernioStoryPost(
  platform: ZernioPlatform,
  mediaUrl: string
): Promise<ZernioResult> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) return { success: false, error: 'ZERNIO_API_KEY not configured' };

  const accountId = ACCOUNT_IDS[platform];
  if (!accountId) return { success: false, error: `Platform ${platform} not connected in Zernio` };

  const res = await fetch(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      platforms: [
        {
          platform,
          accountId,
          platformSpecificData: { contentType: 'story' },
        },
      ],
      mediaItems: [{ url: mediaUrl, type: 'image' }],
      publishNow: true,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error ?? data.message ?? `HTTP ${res.status}`;
    const dailyLimitReached = /daily limit/i.test(String(errorMsg));
    return { success: false, error: errorMsg, dailyLimitReached };
  }

  const postStatus = data.post?.status;
  if (postStatus === 'failed') {
    return { success: false, error: data.message ?? 'Publishing failed' };
  }

  return { success: true, postId: data.post?._id };
}
