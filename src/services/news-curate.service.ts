import {
  findNewsByStatus,
  updateNewsItem,
  setNewsStatus,
} from '@/infra/supabase/repositories/news.repository';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface CurateResult {
  curated: number;
  rejected: number;
  failed: number;
  errors: string[];
}

interface CurationResponse {
  isBeachTennis: boolean;
  language: 'pt' | 'en' | 'es' | 'other';
  translatedTitle: string | null;
  translatedSummary: string | null;
}

export async function curateScrapedNews(): Promise<CurateResult> {
  const items = await findNewsByStatus('scraped');
  const result: CurateResult = { curated: 0, rejected: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      const decision = await classifyWithGroq(item.title, item.summary, item.full_content);

      if (!decision) {
        // Groq falhou — mantém scraped para reprocessar depois
        result.failed++;
        result.errors.push(`[${item.id}] Groq sem resposta`);
        continue;
      }

      if (!decision.isBeachTennis) {
        await setNewsStatus(item.id, 'rejected');
        result.rejected++;
        continue;
      }

      // É Beach Tennis — aplica tradução se necessário
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
  fullContent: string | null
): Promise<CurationResponse | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const contentPreview = (fullContent ?? summary ?? '').slice(0, 600);

  const userMessage = `Analise este artigo de notícia e responda com JSON puro (sem markdown):

Título: ${title}
Resumo: ${summary ?? '(sem resumo)'}
Prévia do conteúdo: ${contentPreview}

Responda apenas com JSON no formato:
{
  "isBeachTennis": true ou false,
  "language": "pt" | "en" | "es" | "other",
  "translatedTitle": "título em português" ou null,
  "translatedSummary": "resumo em português (máx 400 chars)" ou null
}

Regras:
- isBeachTennis = true SOMENTE se o artigo é principalmente sobre o esporte Beach Tennis (o esporte com raquetes jogado na areia)
- Se isBeachTennis = false, os campos de tradução podem ser null
- translatedTitle e translatedSummary só devem ser preenchidos se o idioma NÃO for português
- Se já estiver em português, ambos devem ser null`;

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
          {
            role: 'system',
            content:
              'Você é um classificador de notícias esportivas. Responda apenas com JSON válido, sem markdown.',
          },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      console.warn('[curate] Groq error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as CurationResponse;
    return parsed;
  } catch (err) {
    console.warn('[curate] Erro ao chamar Groq:', err);
    return null;
  }
}
