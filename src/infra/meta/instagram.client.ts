const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

export interface MetaResult {
  success: boolean;
  postId?: string;
  error?: string;
  dailyLimitReached?: boolean;
  tokenExpired?: boolean;
}

/**
 * Publica um Reel no Instagram via Meta Graph API.
 * Fluxo: criar container → aguardar processamento → publicar.
 */
export async function metaInstagramPost(
  accessToken: string,
  igAccountId: string,
  videoUrl: string,
  caption: string
): Promise<MetaResult> {
  try {
    // 1. Criar container de mídia
    const containerRes = await fetch(
      `${GRAPH_BASE}/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          share_to_feed: true,
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error) {
      return handleMetaError(containerData.error);
    }

    const containerId: string = containerData.id;

    // 2. Aguardar processamento do vídeo (até 2 min, polling a cada 5s)
    const status = await pollContainerStatus(containerId, accessToken);
    if (status !== 'FINISHED') {
      return { success: false, error: `Meta: container status "${status}" — vídeo não processou a tempo` };
    }

    // 3. Publicar
    const publishRes = await fetch(
      `${GRAPH_BASE}/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error) {
      return handleMetaError(publishData.error);
    }

    return { success: true, postId: publishData.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function pollContainerStatus(containerId: string, accessToken: string): Promise<string> {
  const maxAttempts = 60; // 60 × 5s = 5 min
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
    const containerRes = await fetch(
      `${GRAPH_BASE}/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'STORIES',
          image_url: imageUrl,
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerRes.json();
    if (!containerRes.ok || containerData.error) return handleMetaError(containerData.error);

    const publishRes = await fetch(
      `${GRAPH_BASE}/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishRes.json();
    if (!publishRes.ok || publishData.error) return handleMetaError(publishData.error);

    return { success: true, postId: publishData.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface InsightsResult {
  success: boolean;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  videoViews?: number;
  plays?: number;
  error?: string;
  tokenExpired?: boolean;
}

/**
 * Busca métricas de um post publicado no Instagram via Insights API.
 * Requer permissão instagram_manage_insights no access token.
 * Métricas ficam disponíveis ~24h após a publicação.
 */
export async function fetchPostInsights(
  igMediaId: string,
  accessToken: string
): Promise<InsightsResult> {
  const metrics = 'reach,impressions,likes,comments,shares,saved,plays,video_views';
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${igMediaId}/insights?metric=${metrics}&period=lifetime&access_token=${accessToken}`
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

    // data.data é um array: [{ name, period, values: [{ value }] }]
    const byName: Record<string, number> = {};
    for (const item of (data.data ?? []) as Array<{ name: string; values?: Array<{ value: number }> }>) {
      byName[item.name] = item.values?.[0]?.value ?? 0;
    }

    return {
      success: true,
      reach:      byName['reach'],
      impressions:byName['impressions'],
      likes:      byName['likes'],
      comments:   byName['comments'],
      shares:     byName['shares'],
      saves:      byName['saved'],
      videoViews: byName['video_views'],
      plays:      byName['plays'],
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function handleMetaError(error: { code?: number; message?: string; error_subcode?: number } | undefined): MetaResult {
  if (!error) return { success: false, error: 'Erro desconhecido da Meta API' };
  const msg = error.message ?? 'Erro Meta API';
  // Token expirado ou inválido
  const tokenExpired = error.code === 190 || error.code === 102;
  // Limite de publicação (código 9 = Application Request Limit, 4 = too many calls)
  const dailyLimitReached = error.code === 9 || error.code === 4 ||
    /limit|quota|too many/i.test(msg);
  return { success: false, error: msg, tokenExpired, dailyLimitReached };
}
