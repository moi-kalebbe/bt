import type { ContentItem } from '@/types/domain';
import { getNicheConfig } from '@/config/niche-configs';
import { getNicheSettings } from '@/infra/supabase/repositories/niche-settings.repository';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function generateCaption(content: ContentItem): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const nicheId = content.niche ?? 'beach-tennis';
  const nicheConfig = getNicheConfig(nicheId);
  // DB tem prioridade sobre niche-configs.ts
  const dbSettings = await getNicheSettings(nicheId).catch(() => null);
  const captionCfg = {
    ...nicheConfig.captionConfig,
    accountHandle: dbSettings?.caption_account_handle || nicheConfig.captionConfig.accountHandle,
    accountTag:    dbSettings?.caption_account_tag    || nicheConfig.captionConfig.accountTag,
  };
  const { accountHandle, accountTag, topicLabel, emoji } = captionCfg;

  if (!apiKey) {
    return buildFallbackCaption(content, nicheConfig.captionConfig);
  }

  const hashtags = extractHashtags(content);
  const author = content.author_display_name ?? content.author_username ?? 'desconhecido';
  const title = content.title ?? content.description ?? '';

  const prompt = `Você é um especialista em criação de legendas cativantes para Reels de ${topicLabel}.

Crie uma legenda envolvente para um Reel com base nestas informações:
- Título/descrição do vídeo original: ${title}
- Autor original: ${author} (@${content.author_username ?? ''})
- Hashtags originais: ${hashtags.slice(0, 5).join(', ')}
- Nossa conta: ${accountHandle}

Regras obrigatórias:
1. Comece com um título criativo relacionado a ${topicLabel} com emojis
2. Escreva uma descrição curta e envolvente (2-3 linhas)
3. Dê créditos ao autor original: Créditos: @${content.author_username ?? author}
4. Inclua ${accountHandle} e ${accountTag} obrigatoriamente
5. Use 5-8 hashtags relevantes de ${topicLabel}
6. Use emojis naturalmente ao longo do texto
7. NUNCA use aspas em nenhuma parte do texto
8. Escreva em português brasileiro
9. Tom: animado, esportivo, inspirador

Formato esperado:
[emoji] Título criativo [emoji]

Descrição envolvente aqui

Créditos: @autor

${accountHandle} ${emoji}

#hashtag1 #hashtag2 #hashtag3 ${accountTag}

Responda APENAS com a legenda, sem comentários adicionais.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 400,
        temperature: 0.8,
        messages: [
          {
            role: 'system',
            content: `Você cria legendas criativas e cativantes para Reels de ${topicLabel} em português brasileiro. Nunca use aspas. Responda apenas com a legenda.`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[caption] Groq error:', res.status, err);
      return buildFallbackCaption(content, nicheConfig.captionConfig);
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';
    return text.trim() || buildFallbackCaption(content, captionCfg);
  } catch (err) {
    console.warn('[caption] Erro ao gerar legenda, usando fallback:', err);
    return buildFallbackCaption(content, captionCfg);
  }
}

function extractHashtags(content: ContentItem): string[] {
  if (!Array.isArray(content.hashtags)) return [];
  return content.hashtags
    .map((h: unknown) => {
      if (typeof h === 'string') return h.replace(/^#/, '');
      if (h && typeof h === 'object' && 'name' in h) return String((h as { name: string }).name);
      return '';
    })
    .filter(Boolean);
}

function buildFallbackCaption(
  content: ContentItem,
  captionConfig: ReturnType<typeof getNicheConfig>['captionConfig']
): string {
  const { accountHandle, accountTag, defaultHashtags, emoji } = captionConfig;
  const author = content.author_username ?? 'creator';
  const hashtags = [
    ...extractHashtags(content).slice(0, 3).map(h => `#${h}`),
    ...defaultHashtags.slice(0, 3).map(h => `#${h}`),
  ].join(' ');

  return `${emoji} ${captionConfig.topicLabel} na veia! 🔥

Confira esse conteúdo incrível!

Créditos: @${author}

${accountHandle} ${emoji}

${hashtags} ${accountTag}`;
}
