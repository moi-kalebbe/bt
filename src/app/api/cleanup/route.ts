import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/infra/supabase/client';
import { deleteFromR2 } from '@/infra/r2/client';

// ─── Classificação por keywords ──────────────────────────────────────────────

const BEACH_TENNIS_POSITIVE = [
  'beach tennis', 'beachtennis', 'beach_tennis', 'bt ', ' bt\n', '#bt',
  'raquete de praia', 'beach tênis', 'beachtenista', 'btbrasil',
  'torneio de beach', 'circuito de beach', 'open de beach',
];

const REJECT_KEYWORDS = [
  'volleyball', 'volei', 'vôlei', 'vólei', 'futevôlei', 'futvolei',
  'wimbledon', 'roland garros', 'us open', 'australian open',
  'atp tour', 'wta tour', 'hard court', 'clay court', 'grass court',
  'pickleball', 'badminton', 'squash',
  'swimwear', 'bikini haul', 'fashion', 'moda praia',
  'surf', 'skate', 'basquete', 'basketball', 'futebol', 'football',
  'natação', 'swimming',
];

function classify(item: {
  title: string | null;
  description: string | null;
  hashtags: string[];
  author_username: string | null;
}): 'keep' | 'reject' | 'uncertain' {
  const text = [
    item.title ?? '',
    item.description ?? '',
    (item.hashtags ?? []).join(' '),
    item.author_username ?? '',
  ].join(' ').toLowerCase();

  // Positivo forte → manter
  for (const kw of BEACH_TENNIS_POSITIVE) {
    if (text.includes(kw.toLowerCase())) return 'keep';
  }

  // Negativo explícito → rejeitar
  for (const kw of REJECT_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) return 'reject';
  }

  return 'uncertain';
}

// ─── Classificação via Groq para casos incertos ───────────────────────────────

async function classifyWithGroq(items: Array<{
  id: string;
  title: string | null;
  description: string | null;
  hashtags: string[];
}>): Promise<Map<string, boolean>> {
  const apiKey = process.env.GROQ_API_KEY;
  const result = new Map<string, boolean>();

  if (!apiKey || items.length === 0) {
    // Sem Groq: mantém por padrão (evita falsos negativos)
    items.forEach((i) => result.set(i.id, true));
    return result;
  }

  const prompt = items
    .map((i, idx) => {
      const text = [i.title, i.description, (i.hashtags ?? []).join(' ')]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 200);
      return `${idx + 1}. ID=${i.id} | "${text}"`;
    })
    .join('\n');

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Você é um classificador de vídeos. Responda APENAS com JSON: {"results":[{"id":"...","isBeachTennis":true/false},...]}. Sem explicações.',
          },
          {
            role: 'user',
            content: `Classifique se cada vídeo é de Beach Tennis (o esporte jogado na areia com raquetes pequenas e bola de espuma). Responda true apenas se for claramente beach tennis.\n\n${prompt}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}');

    for (const r of parsed.results ?? []) {
      result.set(r.id, r.isBeachTennis === true);
    }
  } catch {
    // Em caso de falha, mantém tudo (conservador)
    items.forEach((i) => result.set(i.id, true));
  }

  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Busca todos os itens ainda não publicados e não descartados
  const { data: items, error } = await supabase
    .from('content_items')
    .select('id, title, description, hashtags, author_username, original_video_r2_key, processed_video_r2_key, thumbnail_r2_key, status')
    .not('status', 'in', '("published","discarded")')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const toKeep: string[] = [];
  const toReject: string[] = [];
  const uncertain: typeof items = [];

  for (const item of items ?? []) {
    const result = classify(item);
    if (result === 'keep') toKeep.push(item.id);
    else if (result === 'reject') toReject.push(item.id);
    else uncertain.push(item);
  }

  // Classifica incertos com Groq (em lotes de 20)
  const BATCH = 20;
  for (let i = 0; i < uncertain.length; i += BATCH) {
    const batch = uncertain.slice(i, i + BATCH);
    const groqResult = await classifyWithGroq(batch);
    for (const item of batch) {
      const keep = groqResult.get(item.id) ?? true;
      if (keep) toKeep.push(item.id);
      else toReject.push(item.id);
    }
  }

  if (toReject.length === 0) {
    return NextResponse.json({ kept: toKeep.length, deleted: 0, message: 'Nenhum item para remover.' });
  }

  // Coleta as keys R2 dos itens a deletar
  const rejectItems = (items ?? []).filter((i) => toReject.includes(i.id));
  const r2Keys = rejectItems
    .flatMap((i) => [i.original_video_r2_key, i.processed_video_r2_key, i.thumbnail_r2_key])
    .filter((k): k is string => Boolean(k));

  // Deleta do R2
  if (r2Keys.length > 0) {
    await deleteFromR2(r2Keys);
  }

  // Deleta do Supabase (publish_jobs primeiro por FK)
  await supabase.from('publish_jobs').delete().in('content_item_id', toReject);
  await supabase.from('content_items').delete().in('id', toReject);

  return NextResponse.json({
    kept: toKeep.length,
    deleted: toReject.length,
    r2FilesDeleted: r2Keys.length,
    uncertain: uncertain.length,
    message: `Limpeza concluída. ${toReject.length} itens removidos, ${toKeep.length} mantidos.`,
  });
}
