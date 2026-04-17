export interface NicheRssSource {
  name: string;
  url: string;
  filterKeyword?: string;
  needsResolution?: boolean;
}

export interface NicheCaptionConfig {
  /** Handle da conta no Instagram, ex: '@dicas.beachtennis' */
  accountHandle: string;
  /** Hashtag da conta, ex: '#dicasbeachtennis' */
  accountTag: string;
  /** Hashtags padrão para legendas de fallback */
  defaultHashtags: string[];
  /** Descrição do tema para o prompt do Groq, ex: 'Beach Tennis' */
  topicLabel: string;
  /** Emoji principal do nicho, ex: '🎾' */
  emoji: string;
}

export interface NicheConfig {
  id: string;
  /** Nome da variável de ambiente usada como fallback para o token Apify */
  apifyTokenEnv: string;
  tiktokHashtags: string[];
  /** Hashtags TikTok para scraping de sons virais deste nicho */
  musicHashtags: string[];
  youtubeQuery: string;
  /** Termos no título do vídeo que indicam conteúdo não-técnico a ser rejeitado */
  videoRejectKeywords: string[];
  blockedAuthors: { tiktok: string[]; youtube: string[] };
  newsSources: NicheRssSource[];
  /** Queries para busca no Firecrawl (/v1/search) — encontra artigos de qualquer portal */
  firecrawlQueries: string[];
  newsGroqSystemPrompt: string;
  newsGroqUserPrompt: (title: string, summary: string, content: string) => string;
  /** IDs de conta Zernio para publicação neste nicho */
  zernioAccountIds: { instagram: string; tiktok: string; youtube: string; facebook: string };
  /** Configuração de legendas de vídeo */
  captionConfig: NicheCaptionConfig;
  /** Label do chip no story art de notícias, ex: 'BEACH TENNIS' */
  newsChipLabel: string;
  /** Padrão regex para remover prefixo redundante do título no story art */
  newsTitlePrefixPattern: RegExp;
}

// ──────────────────────────────────────────────────────────────────────────────
// Beach Tennis
// ──────────────────────────────────────────────────────────────────────────────
const beachTennisConfig: NicheConfig = {
  id: 'beach-tennis',
  apifyTokenEnv: 'APIFY_TOKEN',
  musicHashtags: ['trendingsong', 'sertanejo', 'pagodao', 'axe', 'funkbrasil'],
  tiktokHashtags: [
    'beachtennis',
    'beachtennisbrasil',
    'beachtennisplayer',
    'beachtennislovers',
    'beachtennislife',
    'beachtennis2026',
    'beachtennistorneio',
    'beachtennisfeminino',
    'beachtennismasculino',
    'beachtennis_',
  ],
  youtubeQuery: 'beach tennis',
  videoRejectKeywords: [],
  blockedAuthors: {
    tiktok: ['btrobson', 'raphael.bt'],
    youtube: ['btrobson', 'raphael.bt'],
  },
  newsSources: [
    { name: 'Tênis Brasil', url: 'https://tenisbrasil.com.br/feed/', filterKeyword: 'beach tennis' },
    { name: 'BT Brasil', url: 'https://btbrasil.com.br/feed/', filterKeyword: 'beach tennis' },
    { name: 'Beach Tennis News', url: 'https://beachtennis.news/feed/' },
    { name: 'Lance!', url: 'https://www.lance.com.br/feed/', filterKeyword: 'beach tennis' },
    { name: 'ESPN BR', url: 'https://www.espn.com.br/rss/espn.xml', filterKeyword: 'beach tennis' },
    { name: 'G1 Esportes', url: 'https://g1.globo.com/rss/g1/esportes/', filterKeyword: 'beach tennis' },
    { name: 'Terra Esportes', url: 'https://www.terra.com.br/esportes/rss/', filterKeyword: 'beach tennis' },
    { name: 'UOL Esporte', url: 'https://esporte.uol.com.br/ultimas/index.xml', filterKeyword: 'beach tennis' },
    { name: 'Metrópoles', url: 'https://www.metropoles.com/esportes/feed/', filterKeyword: 'beach tennis' },
    {
      name: 'Google News PT',
      url: 'https://news.google.com/rss/search?q=beach+tennis&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
    {
      name: 'Google News - Circuito BT',
      url: 'https://news.google.com/rss/search?q=%22circuito+beach+tennis%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
    {
      name: 'Google News - Torneio BT',
      url: 'https://news.google.com/rss/search?q=%22torneio+beach+tennis%22+OR+%22ranking+beach+tennis%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
    {
      name: 'Google News EN',
      url: 'https://news.google.com/rss/search?q=%22beach+tennis%22&hl=en-US&gl=US&ceid=US:en',
      needsResolution: true,
    },
  ],
  firecrawlQueries: [
    'beach tennis torneio campeonato resultado 2026',
    'circuito beach tennis brasileiro classificação',
    'beach tennis federação estadual notícia',
    'beach tennis ranking CBT atleta',
    'notícias beach tennis Brasil hoje',
  ],
  zernioAccountIds: {
    instagram: '69dd27347dea335c2be735df',
    tiktok:    '69dd28a87dea335c2be7480e',
    youtube:   '69dd28f97dea335c2be74bbb',
    facebook:  '',
  },
  captionConfig: {
    accountHandle: '@dicas.beachtennis',
    accountTag: '#dicasbeachtennis',
    defaultHashtags: ['beachtennis', 'beachtennisbrasil', 'beachtennislovers', 'esporte'],
    topicLabel: 'Beach Tennis',
    emoji: '🎾',
  },
  newsChipLabel: 'BEACH TENNIS',
  newsTitlePrefixPattern: /^beach\s+tennis\s*[:\-–]\s*/i,
  newsGroqSystemPrompt:
    'Você é um especialista em conteúdo esportivo para redes sociais. Responda apenas com JSON válido, sem markdown.',
  newsGroqUserPrompt: (title, summary, content) => `Analise este artigo de Beach Tennis e responda com JSON puro (sem markdown):

Título original: ${title}
Resumo original: ${summary ?? '(sem resumo)'}
Conteúdo: ${content}

Responda apenas com JSON no formato:
{
  "isRelevant": true ou false,
  "language": "pt" | "en" | "es" | "other",
  "rewrittenTitle": "novo título em português" ou null,
  "rewrittenSummary": "parágrafo 1.\\nparágrafo 2.\\nparágrafo 3." ou null
}

Regras:
- isRelevant = true SOMENTE se o artigo é principalmente sobre o esporte Beach Tennis (raquetes na areia)
- Se isRelevant = false, rewrittenTitle e rewrittenSummary devem ser null
- Se isRelevant = true, SEMPRE preencha rewrittenTitle e rewrittenSummary em português do Brasil
- rewrittenTitle: máximo 10 palavras, direto ao ponto, sem prefixo "Beach Tennis:"
- rewrittenSummary: exatamente 3 parágrafos separados por \\n, cada um com 10 a 15 palavras, o terceiro deve despertar curiosidade`,
};

// ──────────────────────────────────────────────────────────────────────────────
// IA & Tech
// ──────────────────────────────────────────────────────────────────────────────
const aiTechConfig: NicheConfig = {
  id: 'ai-tech',
  apifyTokenEnv: 'APIFY_TOKEN_AI',
  musicHashtags: ['lofimusic', 'chillbeats', 'studymusic', 'musicaparaestudiar', 'lofi'],
  tiktokHashtags: [
    'inteligenciaartificial',
    'iaautomacao',
    'automacaocomia',
    'agentesia',
    'vibecoding',
    'n8nautomacao',
    'cursorinteligenciaartificial',
    'programacaocomia',
    'chatgptbrasil',
    'iaparainiiciantes',
    'promptengineering',
    'llm',
    'langchain',
    'aiagentsbrasil',
    'cursor',
  ],
  youtubeQuery: 'inteligência artificial automação tutorial português',
  videoRejectKeywords: [
    // Geração de imagem/vídeo com IA (entretenimento, não técnico) — PT-BR
    'ia gerou', 'ia criou', 'ia fez', 'ia desenhou', 'ia cantando',
    'ia dublou', 'ia transformou', 'filtro de ia', 'filtro ia',
    // Geração de imagem/vídeo com IA — EN
    'midjourney', 'stable diffusion', 'dall-e', 'sora', 'runway ml',
    'ai art', 'ai drew', 'ai generated', 'ai made this', 'kling', 'vo3',
    // Reação/entretenimento
    'chatgpt responde', 'ia responde', 'ai roast', 'ia reage', 'ai react',
    // Off-topic: beach tennis
    'beach tennis', 'beachtennis', 'beach_tennis', 'raquete de praia',
    'beachtenista', 'btbrasil', 'torneio de beach', 'circuito de beach',
  ],
  blockedAuthors: {
    tiktok: [],
    youtube: [],
  },
  newsSources: [
    // ── Portais BR dedicados ──────────────────────────────────────────────
    {
      name: 'Olhar Digital IA',
      url: 'https://olhardigital.com.br/feed/',
      filterKeyword: 'inteligência artificial',
    },
    {
      name: 'Canaltech IA',
      url: 'https://canaltech.com.br/rss/',
      filterKeyword: 'inteligência artificial',
    },
    {
      name: 'TecMundo IA',
      url: 'https://www.tecmundo.com.br/rss',
      filterKeyword: 'inteligência artificial',
    },
    {
      name: 'Convergência Digital',
      url: 'https://www.convergenciadigital.com.br/cgi/cgilua.exe/sys/start.htm?from_info_index=1&tpl=rss_info.htm',
      filterKeyword: 'inteligência artificial',
    },
    // ── Google News PT-BR (agrega todos os portais BR) ────────────────────
    {
      name: 'Google News - IA PT',
      url: 'https://news.google.com/rss/search?q=intelig%C3%AAncia+artificial&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
    {
      name: 'Google News - LLM automação',
      url: 'https://news.google.com/rss/search?q=LLM+automa%C3%A7%C3%A3o+agentes+IA&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
    {
      name: 'Google News - ChatGPT Claude Gemini',
      url: 'https://news.google.com/rss/search?q=ChatGPT+OR+Claude+OR+Gemini+OR+OpenAI&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
  ],
  firecrawlQueries: [
    'inteligência artificial lançamento novidade Brasil 2026',
    'LLM automação agentes IA notícia hoje',
    'OpenAI Anthropic Google IA atualização português',
    'ferramentas IA programação automação Brasil',
  ],
  zernioAccountIds: {
    instagram: process.env.ZERNIO_INSTAGRAM_ID_AI ?? '',
    tiktok:    process.env.ZERNIO_TIKTOK_ID_AI    ?? '',
    youtube:   process.env.ZERNIO_YOUTUBE_ID_AI   ?? '',
    facebook:  '',
  },
  captionConfig: {
    accountHandle: process.env.CAPTION_ACCOUNT_HANDLE_AI ?? '@ia.automacao',
    accountTag:    process.env.CAPTION_ACCOUNT_TAG_AI    ?? '#iaautomacao',
    defaultHashtags: ['ia', 'inteligenciaartificial', 'llm', 'automacao', 'tech'],
    topicLabel: 'IA & Automação',
    emoji: '🤖',
  },
  newsChipLabel: 'IA & TECH',
  newsTitlePrefixPattern: /^(ia|tech)\s*[:\-–&]\s*/i,
  newsGroqSystemPrompt:
    'Você é um especialista em conteúdo tech para redes sociais. Responda apenas com JSON válido, sem markdown.',
  newsGroqUserPrompt: (title, summary, content) => `Analise este artigo de IA/Tech e responda com JSON puro (sem markdown):

Título original: ${title}
Resumo original: ${summary ?? '(sem resumo)'}
Conteúdo: ${content}

Responda apenas com JSON no formato:
{
  "isRelevant": true ou false,
  "language": "pt" | "en" | "es" | "other",
  "rewrittenTitle": "novo título em português" ou null,
  "rewrittenSummary": "parágrafo 1.\\nparágrafo 2.\\nparágrafo 3." ou null
}

Regras:
- isRelevant = true SOMENTE se o artigo trata de tópicos técnicos de IA: LLMs, automação, agentes, engenharia de prompt, MLOps, frameworks (LangChain, n8n, etc.), APIs de IA (OpenAI, Anthropic, Gemini), ou ferramentas dev com IA (Cursor, Copilot)
- isRelevant = false para: geração de imagem/vídeo (Midjourney, Sora, DALL-E), IA em games, entretenimento genérico, robótica física, veículos autônomos, hype sem profundidade técnica
- isRelevant = false se o artigo for em inglês sem relevância direta para o público brasileiro
- Se isRelevant = false, rewrittenTitle e rewrittenSummary devem ser null
- Se isRelevant = true, SEMPRE preencha rewrittenTitle e rewrittenSummary em português do Brasil
- rewrittenTitle: máximo 10 palavras, direto ao ponto, sem prefixo "IA:" ou "Tech:"
- rewrittenSummary: exatamente 3 parágrafos separados por \\n, cada um com 10 a 15 palavras, o terceiro deve despertar curiosidade`,
};

// ──────────────────────────────────────────────────────────────────────────────
// Registro central
// ──────────────────────────────────────────────────────────────────────────────
const NICHE_CONFIGS: Record<string, NicheConfig> = {
  'beach-tennis': beachTennisConfig,
  'ai-tech': aiTechConfig,
};

export function getNicheConfig(nicheId: string): NicheConfig {
  const config = NICHE_CONFIGS[nicheId];
  if (!config) {
    throw new Error(`Nicho desconhecido: "${nicheId}". Disponíveis: ${Object.keys(NICHE_CONFIGS).join(', ')}`);
  }
  return config;
}

export async function getApifyToken(nicheId: string): Promise<string> {
  const { getNicheSettings } = await import('../infra/supabase/repositories/niche-settings.repository');
  const dbSettings = await getNicheSettings(nicheId).catch(() => null);
  if (dbSettings?.apify_token) return dbSettings.apify_token;
  const config = getNicheConfig(nicheId);
  const token = process.env[config.apifyTokenEnv];
  if (!token) {
    throw new Error(`Token Apify não configurado para o nicho "${nicheId}". Configure em Configurações > Token Apify ou defina a variável ${config.apifyTokenEnv}.`);
  }
  return token;
}
