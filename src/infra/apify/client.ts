export class ApifyClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async runActor<TOutput>(
    actorId: string,
    input: Record<string, unknown> = {},
    limit: number = 2000
  ): Promise<TOutput[]> {
    // Apify usa '~' como separador no URL (ex: clockworks~tiktok-scraper)
    const safeId = actorId.replace('/', '~');
    const url = `https://api.apify.com/v2/acts/${safeId}/run-sync-get-dataset-items?token=${this.token}&timeout=300&limit=${limit}&maxItems=${limit}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Apify API error: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
    }

    return response.json() as Promise<TOutput[]>;
  }

  async getDatasetItems<T>(
    datasetId: string,
    options?: {
      limit?: number;
      offset?: number;
      clean?: boolean;
    }
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.clean) params.set('clean', 'true');

    const url = `https://api.apify.com/v2/datasets/${datasetId}/items${params.toString() ? `?${params}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T[]>;
  }
}

export function createApifyClient(token?: string): ApifyClient {
  const actualToken = token ?? process.env.APIFY_TOKEN;
  if (!actualToken) {
    throw new Error('Apify token not configured');
  }
  return new ApifyClient(actualToken);
}
