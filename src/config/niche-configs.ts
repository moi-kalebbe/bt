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
  /** Nome da variável de ambiente que contém o token Apify para este nicho */
  apifyTokenEnv: string;
  tiktokHashtags: string[];
  youtubeQuery: string;
  /** Termos no título do vídeo que indicam conteúdo não-técnico a ser rejeitado */
  videoRejectKeywords: string[];
  blockedAuthors: { tiktok: string[]; youtube: string[] };
  newsSources: NicheRssSource[];
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
    { name: 'Tênis Brasil', url: 'https://tenisbrasil.com.br/feed/' },
    { name: 'CBT', url: 'https://cbt.org.br/feed/' },
    { name: 'BT Brasil', url: 'https://btbrasil.com.br/feed/' },
    { name: 'Beach Tennis News', url: 'https://beachtennis.news/feed/' },
    { name: 'Lance!', url: 'https://www.lance.com.br/feed/', filterKeyword: 'beach tennis' },
    { name: 'ESPN BR', url: 'https://www.espn.com.br/rss/espn.xml', filterKeyword: 'beach tennis' },
    { name: 'G1 Esportes', url: 'https://g1.globo.com/rss/g1/esportes/', filterKeyword: 'beach tennis' },
    { name: 'Terra Esportes', url: 'https://www.terra.com.br/esportes/rss/', filterKeyword: 'beach tennis' },
    {
      name: 'Google News PT',
      url: 'https://news.google.com/rss/search?q=beach+tennis&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
    {
      name: 'Google News EN',
      url: 'https://news.google.com/rss/search?q=%22beach+tennis%22&hl=en-US&gl=US&ceid=US:en',
      needsResolution: true,
    },
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
    'Você é um classificador de notícias esportivas. Responda apenas com JSON válido, sem markdown.',
  newsGroqUserPrompt: (title, summary, content) => `Analise este artigo de notícia e responda com JSON puro (sem markdown):

Título: ${title}
Resumo: ${summary ?? '(sem resumo)'}
Prévia do conteúdo: ${content}

Responda apenas com JSON no formato:
{
  "isRelevant": true ou false,
  "language": "pt" | "en" | "es" | "other",
  "translatedTitle": "título em português" ou null,
  "translatedSummary": "resumo em português (máx 400 chars)" ou null
}

Regras:
- isRelevant = true SOMENTE se o artigo é principalmente sobre o esporte Beach Tennis (o esporte com raquetes jogado na areia)
- Se isRelevant = false, os campos de tradução podem ser null
- translatedTitle e translatedSummary só devem ser preenchidos se o idioma NÃO for português
- Se já estiver em português, ambos devem ser null`,
};

// ──────────────────────────────────────────────────────────────────────────────
// IA & Tech
// ──────────────────────────────────────────────────────────────────────────────
const aiTechConfig: NicheConfig = {
  id: 'ai-tech',
  apifyTokenEnv: 'APIFY_TOKEN_AI',
  tiktokHashtags: [
    'vibecoding',
    'llm',
    'langchain',
    'aiagents',
    'promptengineering',
    'aiautomation',
    'aiprogramming',
    'cursorai',
    'n8nautomation',
    'aiworkflow',
    'openaiapi',
    'claudeai',
    'machinelearning',
    'deeplearning',
    'llmops',
  ],
  youtubeQuery: 'ai automation tutorial',
  videoRejectKeywords: [
    // Conteúdo de geração de imagem/vídeo (não técnico)
    'vo3',
    'sora',
    'runway ml',
    'midjourney',
    'stable diffusion',
    'ai art',
    'ai drew',
    'ai generated',
    'ia gerou',
    'ia criou',
    'ai fez',
    'ai made this',
    'chatgpt responde',
    'ia responde',
    'ai roast',
    'ia reage',
    'ai react',
    'dall-e',
    'kling',
    // Conteúdo claramente off-topic: beach tennis
    'beach tennis',
    'beachtennis',
    'beach_tennis',
    'raquete de praia',
    'beachtenista',
    'btbrasil',
    'torneio de beach',
    'circuito de beach',
  ],
  blockedAuthors: {
    tiktok: [],
    youtube: [],
  },
  newsSources: [
    {
      name: 'The Verge AI',
      url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    },
    {
      name: 'TechCrunch AI',
      url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    },
    {
      name: 'VentureBeat AI',
      url: 'https://venturebeat.com/category/ai/feed/',
    },
    {
      name: 'MIT Tech Review',
      url: 'https://www.technologyreview.com/feed/',
    },
    {
      name: 'Ars Technica',
      url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    },
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
      name: 'Google News IA PT',
      url: 'https://news.google.com/rss/search?q=LLM+IA+automa%C3%A7%C3%A3o+agentes&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      needsResolution: true,
    },
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
    'Você é um classificador de artigos técnicos sobre Inteligência Artificial. Responda apenas com JSON válido, sem markdown.',
  newsGroqUserPrompt: (title, summary, content) => `Analise este artigo e responda com JSON puro (sem markdown):

Título: ${title}
Resumo: ${summary ?? '(sem resumo)'}
Prévia do conteúdo: ${content}

Responda apenas com JSON no formato:
{
  "isRelevant": true ou false,
  "language": "pt" | "en" | "es" | "other",
  "translatedTitle": "título em português" ou null,
  "translatedSummary": "resumo em português (máx 400 chars)" ou null
}

Regras:
- isRelevant = true SOMENTE se o artigo trata de tópicos técnicos de IA: LLMs, modelos de linguagem, automação com IA, agentes de IA, engenharia de prompt, MLOps, frameworks (LangChain, LlamaIndex, CrewAI, n8n, etc.), APIs de IA (OpenAI, Anthropic, Google Gemini), pesquisa em deep learning, ou ferramentas de desenvolvimento assistido por IA (Cursor, GitHub Copilot, etc.)
- isRelevant = false para: geração de imagens/vídeos (Midjourney, Sora, DALL-E, Runway), IA em games, IA em entretenimento genérico, robótica física, veículos autônomos, ou conteúdo de hype sem profundidade técnica
- translatedTitle e translatedSummary só devem ser preenchidos se o idioma NÃO for português
- Se já estiver em português, ambos devem ser null`,
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

export function getApifyToken(nicheId: string): string {
  const config = getNicheConfig(nicheId);
  const token = process.env[config.apifyTokenEnv];
  if (!token) {
    throw new Error(`Token Apify não configurado: variável ${config.apifyTokenEnv} está vazia`);
  }
  return token;
}
