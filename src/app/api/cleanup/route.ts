import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from '@/lib/request';
import { supabase } from '@/infra/supabase/client';
import { deleteFromR2 } from '@/infra/r2/client';
import { findContents } from '@/infra/supabase/repositories/content.repository';

// ─── Keywords: Beach Tennis ───────────────────────────────────────────────────

const BEACH_TENNIS_POSITIVE = [
  'beach tennis', 'beachtennis', 'beach_tennis', 'bt ', ' bt\n', '#bt',
  'raquete de praia', 'beach tênis', 'beachtenista', 'btbrasil',
  'torneio de beach', 'circuito de beach', 'open de beach',
];

const BEACH_TENNIS_REJECT = [
  'volleyball', 'volei', 'vôlei', 'vólei', 'futevôlei', 'futvolei',
  'wimbledon', 'roland garros', 'us open', 'australian open',
  'atp tour', 'wta tour', 'hard court', 'clay court', 'grass court',
  'pickleball', 'badminton', 'squash',
  'swimwear', 'bikini haul', 'fashion', 'moda praia',
  'surf', 'skate', 'basquete', 'basketball', 'futebol', 'football',
  'natação', 'swimming',
];

// ─── Keywords: IA & Tech ──────────────────────────────────────────────────────

const AI_TECH_POSITIVE = [
  'llm', 'langchain', 'ai agent', 'aiagent', 'prompt engineering', 'promptengineering',
  'ai automation', 'aiautomation', 'n8n', 'openai', 'anthropic', 'claude ai', 'claudeai',
  'chatgpt', 'gemini', 'llmops', 'machine learning', 'deep learning', 'neural network',
  'vibe coding', 'vibecoding', 'ai programming', 'aiprogramming', 'cursor ai',
  'github copilot', 'inteligência artificial', 'automação com ia', 'agente de ia',
  'ai workflow', 'aiworkflow', 'openai api', 'openaiapi', 'fine-tuning', 'rag ',
  '#llm', '#aiagents', '#promptengineering', '#n8n', '#langchain', '#vibecoding',
  '#machinelearning', '#deeplearning', '#llmops', '#aiautomation',
];

const AI_TECH_REJECT = [
  'beach tennis', 'beachtennis', 'beach_tennis', 'raquete de praia', 'beachtenista',
  'torneio bt', 'circuito bt', '#beachtennis',
];

// ─── Classificação por keywords ───────────────────────────────────────────────

function classify(
  item: { title: string | null; description: string | null; hashtags: string[]; author_username: string | null },
  niche: string
): 'keep' | 'reject' | 'uncertain' {
  const text = [
    item.title ?? '',
    item.description ?? '',
    (item.hashtags ?? []).join(' '),
    item.author_username ?? '',
  ].join(' ').toLowerCase();

  if (niche === 'ai-tech') {
    // Rejeição explícita: conteúdo claramente off-topic (ex: beach tennis)
    for (const kw of AI_TECH_REJECT) {
      if (text.includes(kw.toLowerCase())) return 'reject';
    }
    // Positivo forte: tem keywords de IA → manter
    for (const kw of AI_TECH_POSITIVE) {
      if (text.includes(kw.toLowerCase())) return 'keep';
    }
    return 'uncertain';
  }

  // Padrão: nicho beach-tennis
  for (const kw of BEACH_TENNIS_POSITIVE) {
    if (text.includes(kw.toLowerCase())) return 'keep';
  }
  for (const kw of BEACH_TENNIS_REJECT) {
    if (text.includes(kw.toLowerCase())) return 'reject';
  }
  return 'uncertain';
}

// ─── Classificação via Groq para casos incertos ───────────────────────────────

async function classifyWithGroq(
  items: Array<{ id: string; title: string | null; description: string | null; hashtags: string[] }>,
  niche: string
): Promise<Map<string, boolean>> {
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

  const isAiTech = niche === 'ai-tech';

  const systemPrompt = isAiTech
    ? 'Você é um classificador de vídeos. Responda APENAS com JSON: {"results":[{"id":"...","isRelevant":true/false},...]}. Sem explicações.'
    : 'Você é um classificador de vídeos. Responda APENAS com JSON: {"results":[{"id":"...","isRelevant":true/false},...]}. Sem explicações.';

  const userPrompt = isAiTech
    ? `Classifique se cada vídeo é de conteúdo técnico de IA: LLMs, automação com IA, agentes de IA, engenharia de prompt, frameworks (LangChain, n8n, CrewAI), APIs de IA, MLOps, vibe coding, ou ferramentas de dev assistido por IA. Responda true apenas se for claramente sobre IA/tech.\n\n${prompt}`
    : `Classifique se cada vídeo é de Beach Tennis (o esporte jogado na areia com raquetes pequenas e bola de espuma). Responda true apenas se for claramente beach tennis.\n\n${prompt}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}');

    for (const r of parsed.results ?? []) {
      result.set(r.id, r.isRelevant === true);
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

  const { niche = 'beach-tennis' } = await parseBody(request);

  // Busca itens do nicho ainda não publicados — usa findContents que já suporta niche
  const { items: allItems } = await findContents({ niche, limit: 500 }).catch(() => ({ items: [], total: 0 }));
  const items = allItems.filter((i) => i.status !== 'published' && i.status !== 'ignored_duplicate');

  const toKeep: string[] = [];
  const toReject: string[] = [];
  const uncertain: typeof items = [];

  for (const item of items) {
    const result = classify(item, niche);
    if (result === 'keep') toKeep.push(item.id);
    else if (result === 'reject') toReject.push(item.id);
    else uncertain.push(item);
  }

  // Classifica incertos com Groq (em lotes de 20)
  const BATCH = 20;
  for (let i = 0; i < uncertain.length; i += BATCH) {
    const batch = uncertain.slice(i, i + BATCH);
    const groqResult = await classifyWithGroq(batch, niche);
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
  const rejectItems = (items).filter((i) => toReject.includes(i.id));
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
    niche,
    kept: toKeep.length,
    deleted: toReject.length,
    r2FilesDeleted: r2Keys.length,
    uncertain: uncertain.length,
    message: `Limpeza concluída (${niche}). ${toReject.length} itens removidos, ${toKeep.length} mantidos.`,
  });
}
