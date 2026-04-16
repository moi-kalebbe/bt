import {
  findNewsByStatus,
  updateNewsItem,
  setNewsStatus,
} from '@/infra/supabase/repositories/news.repository';
import { getNicheConfig } from '@/config/niche-configs';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface CurateResult {
  curated: number;
  rejected: number;
  failed: number;
  errors: string[];
}

interface CurationResponse {
  isRelevant: boolean;
  language: 'pt' | 'en' | 'es' | 'other';
  translatedTitle: string | null;
  translatedSummary: string | null;
}

const MAX_AGE_DAYS = 7;
// Delay entre chamadas ao Groq para não estourar o rate limit (6000 tokens/min)
const GROQ_DELAY_MS = 1_500;

function isTooOld(publishedAt: string | null, createdAt: string): boolean {
  // Usa published_at se disponível E se for anterior a created_at
  // (evita casos em que Firecrawl retorna published_at da data de hoje)
  const candidates = [publishedAt, createdAt].filter(Boolean) as string[];
  // Pega a data mais antiga entre published_at e created_at
  const oldest = candidates.reduce((a, b) =>
    new Date(a).getTime() < new Date(b).getTime() ? a : b
  );
  const age = Date.now() - new Date(oldest).getTime();
  return age > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export async function curateScrapedNews(niche = 'beach-tennis'): Promise<CurateResult> {
  const config = getNicheConfig(niche);
  const items = await findNewsByStatus('scraped', 100, niche);
  const result: CurateResult = { curated: 0, rejected: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      // Rejeita automaticamente artigos antigos (> 7 dias) sem gastar tokens do Groq
      if (isTooOld(item.published_at, item.created_at)) {
        await setNewsStatus(item.id, 'rejected');
        result.rejected++;
        continue;
      }

      // Throttle: respeita o rate limit do Groq (6000 tokens/min)
      await new Promise((r) => setTimeout(r, GROQ_DELAY_MS));

      const decision = await classifyWithGroq(
        item.title,
        item.summary,
        item.full_content,
        config.newsGroqSystemPrompt,
        config.newsGroqUserPrompt
      );

      if (!decision) {
        result.failed++;
        result.errors.push(`[${item.id}] Groq sem resposta`);
        continue;
      }

      if (!decision.isRelevant) {
        await setNewsStatus(item.id, 'rejected');
        result.rejected++;
        continue;
      }

      const patch: Record<string, unknown> = {
        status: 'curated',
        curated_at: new Date().toISOString(),
        error_message: null,
      };

      if (decision.translatedTitle) patch.title = decision.translatedTitle;
      if (decision.translatedSummary) patch.summary = decision.translatedSummary;

      await updateNewsItem(item.id, patch);
      result.curated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.errors.push(`[${item.id}] ${msg}`);
    }
  }

  return result;
}

async function classifyWithGroq(
  title: string,
  summary: string | null,
  fullContent: string | null,
  systemPrompt: string,
  userPromptFn: (title: string, summary: string, content: string) => string
): Promise<CurationResponse | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const contentPreview = (fullContent ?? summary ?? '').slice(0, 600);
  const userMessage = userPromptFn(title, summary ?? '(sem resumo)', contentPreview);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (res.status === 429) {
      // Rate limit: espera 10s e tenta uma vez mais
      await new Promise((r) => setTimeout(r, 10_000));
      return classifyWithGroq(title, summary, fullContent, systemPrompt, userPromptFn);
    }
    if (!res.ok) {
      console.warn('[curate] Groq error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';
    return JSON.parse(text) as CurationResponse;
  } catch (err) {
    console.warn('[curate] Erro ao chamar Groq:', err);
    return null;
  }
}
