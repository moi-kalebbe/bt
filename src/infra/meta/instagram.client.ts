const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

export interface MetaResult {
  success: boolean;
  postId?: string;
  mediaId?: string;
  error?: string;
  dailyLimitReached?: boolean;
  tokenExpired?: boolean;
}

export const REELS_INSIGHT_METRICS = 'reach,likes,comments,shares,saved,views';

/**
 * Publica um Reel no Instagram via Meta Graph API.
 * Fluxo: criar container -> aguardar processamento -> publicar.
 */
export async function metaInstagramPost(
  accessToken: string,
  igAccountId: string,
  videoUrl: string,
  caption: string
): Promise<MetaResult> {
  try {
    const containerRes = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: accessToken,
      }),
    });

    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error) {
      return handleMetaError(containerData.error);
    }

    const containerId: string = containerData.id;

    const status = await pollContainerStatus(containerId, accessToken);
    if (status !== 'FINISHED') {
      return {
        success: false,
        error: `Meta: container status "${status}" - video nao processou a tempo`,
      };
    }

    const publishRes = await fetch(`${GRAPH_BASE}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error) {
      return handleMetaError(publishData.error);
    }

    return { success: true, postId: publishData.id, mediaId: publishData.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function pollContainerStatus(containerId: string, accessToken: string): Promise<string> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    const code: string = data.status_code ?? 'IN_PROGRESS';
    if (code === 'FINISHED' || code === 'ERROR' || code === 'EXPIRED') return code;
  }
  return 'TIMEOUT';
}

/**
 * Publica uma imagem como Instagram Story via Meta Graph API.
 */
export async function metaInstagramStoryPost(
  accessToken: string,
  igAccountId: string,
  imageUrl: string
): Promise<MetaResult> {
  try {
    const containerRes = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'STORIES',
        image_url: imageUrl,
        access_token: accessToken,
      }),
    });

    const containerData = await containerRes.json();
    if (!containerRes.ok || containerData.error) return handleMetaError(containerData.error);

    const publishRes = await fetch(`${GRAPH_BASE}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok || publishData.error) return handleMetaError(publishData.error);

    return { success: true, postId: publishData.id, mediaId: publishData.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface InsightsResult {
  success: boolean;
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  videoViews?: number | null;
  plays?: number | null;
  error?: string;
  tokenExpired?: boolean;
}

interface InsightsApiMetricValue {
  value: number;
}

interface InsightsApiMetric {
  name: string;
  values?: InsightsApiMetricValue[];
}

interface InsightsApiResponse {
  data?: InsightsApiMetric[];
}

export function parseInsightsApiResponse(data: InsightsApiResponse): InsightsResult {
  const byName: Record<string, number> = {};
  for (const item of data.data ?? []) {
    byName[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    success: true,
    reach: byName['reach'] ?? null,
    impressions: null,
    likes: byName['likes'] ?? null,
    comments: byName['comments'] ?? null,
    shares: byName['shares'] ?? null,
    saves: byName['saved'] ?? null,
    videoViews: null,
    plays: byName['views'] ?? null,
  };
}

/**
 * Busca metricas de um post publicado no Instagram via Insights API.
 * Requer permissao instagram_manage_insights no access token.
 * Metricas ficam disponiveis ~24h apos a publicacao.
 */
export async function fetchPostInsights(
  igMediaId: string,
  accessToken: string
): Promise<InsightsResult> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${igMediaId}/insights?metric=${REELS_INSIGHT_METRICS}&period=lifetime&access_token=${accessToken}`
    );
    const data = await res.json();

    if (!res.ok || data.error) {
      const err = data.error as { code?: number; message?: string } | undefined;
      return {
        success: false,
        error: err?.message ?? 'Erro ao buscar insights',
        tokenExpired: err?.code === 190 || err?.code === 102,
      };
    }

    return parseInsightsApiResponse(data as InsightsApiResponse);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function handleMetaError(
  error: { code?: number; message?: string; error_subcode?: number } | undefined
): MetaResult {
  if (!error) return { success: false, error: 'Erro desconhecido da Meta API' };

  const msg = error.message ?? 'Erro Meta API';
  const tokenExpired = error.code === 190 || error.code === 102;
  const dailyLimitReached =
    error.code === 9 || error.code === 4 || /limit|quota|too many/i.test(msg);

  return { success: false, error: msg, tokenExpired, dailyLimitReached };
}
