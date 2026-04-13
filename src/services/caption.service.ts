import type { ContentItem } from '@/types/domain';

const ACCOUNT_HANDLE = '@dicas.beachtennis';
const ACCOUNT_TAG = '#dicasbeachtennis';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function generateCaption(content: ContentItem): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return buildFallbackCaption(content);
  }

  const hashtags = extractHashtags(content);
  const author = content.author_display_name ?? content.author_username ?? 'desconhecido';
  const title = content.title ?? content.description ?? '';

  const prompt = `Você é um especialista em criação de legendas cativantes para Reels de Beach Tennis.

Crie uma legenda envolvente para um Reel com base nestas informações:
- Título/descrição do vídeo original: ${title}
- Autor original: ${author} (@${content.author_username ?? ''})
- Hashtags originais: ${hashtags.slice(0, 5).join(', ')}
- Nossa conta: ${ACCOUNT_HANDLE}

Regras obrigatórias:
1. Comece com um título criativo relacionado ao beach tennis com emojis
2. Escreva uma descrição curta e envolvente (2-3 linhas)
3. Dê créditos ao autor original: Créditos: @${content.author_username ?? author}
4. Inclua ${ACCOUNT_HANDLE} e ${ACCOUNT_TAG} obrigatoriamente
5. Use 5-8 hashtags relevantes de beach tennis
6. Use emojis naturalmente ao longo do texto
7. NUNCA use aspas em nenhuma parte do texto
8. Escreva em português brasileiro
9. Tom: animado, esportivo, inspirador

Formato esperado:
[emoji] Título criativo [emoji]

Descrição envolvente aqui

Créditos: @autor

${ACCOUNT_HANDLE} 🎾

#hashtag1 #hashtag2 #hashtag3 ${ACCOUNT_TAG}

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
            content: 'Você cria legendas criativas e cativantes para Reels de Beach Tennis em português brasileiro. Nunca use aspas. Responda apenas com a legenda.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[caption] Groq error:', res.status, err);
      return buildFallbackCaption(content);
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';
    return text.trim() || buildFallbackCaption(content);
  } catch (err) {
    console.warn('[caption] Erro ao gerar legenda, usando fallback:', err);
    return buildFallbackCaption(content);
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

function buildFallbackCaption(content: ContentItem): string {
  const author = content.author_username ?? 'beachtennis';
  const hashtags = extractHashtags(content).slice(0, 4).map(h => `#${h}`).join(' ');

  return `🎾 Beach Tennis na veia! 🔥

Confira esse ponto incrível!

Créditos: @${author}

${ACCOUNT_HANDLE} 🏖️

${hashtags} ${ACCOUNT_TAG} #beachtennis #esporte`;
}
