# Content Pipeline — Beach Tennis & IA & Tech

Sistema multi-nicho para coleta, processamento e publicação de conteúdo (vídeos e notícias) no Instagram, TikTok e YouTube.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│               Docker Swarm (gerenciado pelo Portainer)          │
│                                                                 │
│  ┌──────────────────────────────────┐  ┌──────────────────────┐ │
│  │       scrapper (Next.js 15)      │  │   ffmpeg-worker      │ │
│  │  Admin UI · API Routes · Cron    │  │   (processamento)    │ │
│  └──────────────────────────────────┘  └──────────────────────┘ │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
   ┌───────▼──────┐  ┌───────────────┐  ┌────────▼──────┐
   │   SUPABASE   │  │  Cloudflare   │  │  Serviços ext │
   │  PostgreSQL  │  │  R2 Storage   │  │  Apify/Groq   │
   └──────────────┘  └───────────────┘  └───────────────┘
```

## Stack

- **Frontend/Backend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **Deploy**: Docker Swarm + Portainer
- **Scraping**: Apify (TikTok, YouTube), Firecrawl (notícias), RSS
- **IA**: Groq (Llama 3.3 70B) — curadoria de notícias e geração de legendas
- **Publicação**: Meta Graph API (primário) + Zernio (fallback)
- **Processamento de vídeo**: FFmpeg Worker (container separado)

## Nichos

| Nicho | Conta Instagram | Conteúdo |
|-------|----------------|---------|
| `beach-tennis` | @dicas.beachtennis | Vídeos TikTok/YT + notícias |
| `ai-tech` | @ia.automacao | Vídeos TikTok/YT + notícias |

## Pipeline de Notícias

```
Fetch (RSS + Firecrawl)
  → Scrape (Readability + Jina Reader fallback)
  → Curate (Groq IA — filtra relevância)
  → Compose (story art 1080×1920px com Sharp)
  → Publish (Meta Graph API → fallback Zernio)
```

**Cron automático** (em `scripts/cron.ts`) roda às 08h e 20h BRT.

## Pipeline de Vídeos

```
Scrape Apify (TikTok hashtags / YouTube query)
  → Download (yt-dlp + thumbnail)
  → Upload R2
  → Processar FFmpeg (trilha + formato 9:16)
  → Publicar (Instagram Reels / TikTok / YouTube Shorts)
```

## Configuração

### 1. Variáveis de Ambiente

```bash
cp .env.example .env.local
```

Preencha:
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- **Apify**: `APIFY_TOKEN`, `APIFY_TOKEN_AI`
- **Firecrawl**: `FIRECRAWL_API_KEY`
- **Groq**: `GROQ_API_KEY`
- **Zernio**: `ZERNIO_API_KEY`
- **Meta**: configurado via painel admin → Configurações

### 2. Desenvolvimento local

```bash
npm install
npm run dev           # Next.js em localhost:3000
```

FFmpeg Worker (opcional para dev):
```bash
cd workers/ffmpeg-worker
npm install
npm run dev           # localhost:3001
```

### 3. Deploy (Docker Swarm)

```bash
docker stack deploy -c docker-compose.yml scrapper
```

Gerenciar via **Portainer** apontado para o Swarm.

## Scripts

```bash
npm run dev        # Desenvolvimento
npm run build      # Build de produção
npm run start      # Produção local
npm run lint       # ESLint
npm run typecheck  # TypeScript sem emit
```

## Estrutura Principal

```
src/
├── app/
│   ├── (admin)/admin/      # Painel admin (news, gallery, schedule, settings)
│   └── api/                # API Routes (news/*, videos/*, scrape/*, etc.)
├── config/
│   └── niche-configs.ts    # Configuração centralizada por nicho
├── services/               # Lógica de negócio
│   ├── news-fetch.service.ts     # RSS + Firecrawl → scrape
│   ├── news-firecrawl.service.ts # Busca via Firecrawl API
│   ├── news-curate.service.ts    # Curadoria com Groq
│   ├── news-compose.service.ts   # Geração de story art
│   └── news-publish.service.ts   # Publicação Instagram
├── infra/
│   ├── supabase/           # Cliente + repositórios
│   └── r2/                 # Cliente Cloudflare R2
└── types/domain.ts         # Tipos compartilhados
scripts/
└── cron.ts                 # Agendador interno (roda no container)
workers/
└── ffmpeg-worker/          # Serviço de processamento de vídeo
```

## Status de Notícias

| Status | Descrição |
|--------|-----------|
| `discovered` | Encontrada via RSS/Firecrawl |
| `scraped` | Conteúdo extraído |
| `curated` | Aprovada pela IA |
| `rejected` | Rejeitada pela IA |
| `story_composed` | Story art gerado |
| `published` | Publicado no Instagram |
| `failed` | Erro em alguma etapa |

## API Endpoints (Notícias)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/news/fetch` | POST | Busca RSS + Firecrawl |
| `/api/news/curate` | POST | Curadoria com Groq |
| `/api/news/compose-pending` | POST | Gera story art pendentes |
| `/api/news/publish-today` | POST | Publica stories do dia |
| `/api/news/clear` | POST | Limpa banco por nicho |
| `/api/news/[id]/compose` | POST | Story art de item específico |
| `/api/news/[id]/publish` | POST | Publica item específico |
