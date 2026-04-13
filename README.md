# Beach Tennis Video Pipeline

Sistema completo para coleta, armazenamento, processamento e publicação de vídeos de beach tennis.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Admin UI   │  │   API Routes │  │   BullMQ (Upstash)     │ │
│  │  (shadcn/ui) │  │  /videos     │  │   scrape → ingest     │ │
│  │  /admin      │  │  /schedule   │  │   → process → publish  │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   SUPABASE    │  │   R2 (Raw +   │  │  UPSTASH      │
│   PostgreSQL  │  │   Processed)  │  │  Redis        │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **Queue**: Upstash Redis + BullMQ
- **Processing**: FFmpeg Worker separado

## Configuração

### 1. Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

Configure:
- **Supabase**: URL e Service Role Key
- **R2**: Account ID, Access Key, Secret Key, Bucket Name
- **Upstash Redis**: REST URL e Token
- **Apify**: Token e Actor IDs

### 2. Configurar Apify (opcional)

```bash
npm run cli
```

Isso vai configurar interativamente os tokens do Apify.

### 3. Instalar Dependências

```bash
npm install
```

### 4. Executar FFmpeg Worker (para processamento)

```bash
cd workers/ffmpeg-worker
npm install
npm run dev
```

### 5. Iniciar o Projeto

```bash
npm run dev
```

Acesse http://localhost:3000

## Scripts

```bash
npm run dev        # Desenvolvimento
npm run build      # Build de produção
npm run start      # Iniciar em produção
npm run lint       # Verificar código
npm run typecheck  # Verificar tipos
npm run test       # Executar testes
npm run cli        # CLI de configuração
```

## Estrutura de Pastas

```
src/
├── app/                    # Next.js App Router
│   ├── (admin)/            # Painel administrativo
│   │   ├── admin/          # Páginas (gallery, schedule, settings)
│   │   └── _components/    # Componentes reutilizáveis
│   └── api/                # API Routes
│       ├── videos/         # CRUD de vídeos
│       ├── scrape/         # Dispara coleta
│       ├── schedule/       # Scheduler automático
│       └── webhooks/       # Webhooks (FFmpeg callback)
├── components/ui/          # Componentes shadcn/ui
├── domain/                 # Lógica de domínio pura
├── infra/                  # Infraestrutura
│   ├── supabase/           # Cliente e repositórios
│   ├── r2/                 # Cliente S3-compatible
│   ├── redis/              # Cliente Upstash Redis
│   └── apify/              # Cliente Apify
├── services/               # Casos de uso
└── lib/                    # Utilitários
```

## Fluxo Operacional

### 1. Coleta (Scrape)
- Executa scrapers do Apify (TikTok e YouTube)
- Normaliza dados para formato único
- Aplica blacklist de autores
- Detecta duplicados por `source_video_id` e hash

### 2. Ingestão (Ingest)
- Baixa vídeo e thumbnail
- Faz upload para R2
- Atualiza status para `uploaded_r2`

### 3. Agendamento (Schedule)
- Seleção automática por score
- Define slots de manhã (8h) e noite (18h)
- Cria jobs de publicação

### 4. Processamento (Process)
- FFmpeg Worker aplica trilha de fundo
- Gera versões Reels (9:16) ou Stories (1:1)
- Upload da versão processada para R2

### 5. Publicação (Publish)
- Publica via API do Instagram/Facebook
- Atualiza status para `published`

## API Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `GET /api/videos` | GET | Lista vídeos com filtros |
| `GET /api/videos/[id]` | GET | Detalhes de um vídeo |
| `POST /api/videos/[id]/schedule` | POST | Agenda para slot |
| `POST /api/scrape` | POST | Dispara coleta |
| `POST /api/schedule` | POST | Roda scheduler automático |
| `GET /api/health` | GET | Health check |

## Status dos Vídeos

| Status | Descrição |
|--------|-----------|
| `discovered` | Encontrado pelo scraper |
| `filtered_out` | Bloqueado por blacklist |
| `downloaded` | Baixado localmente |
| `uploaded_r2` | Enviado para R2 |
| `ready` | Pronto para agendamento |
| `scheduled` | Agendado para slot |
| `processing` | Processando com FFmpeg |
| `published` | Publicada no destino |
| `failed` | Erro no processamento |
| `ignored_duplicate` | Duplicado detectado |

## Testes

```bash
npm run test
```

## Deploy

### Vercel (Frontend + API)
```bash
npm run build
vercel deploy
```

### FFmpeg Worker (Railway/Render)
```bash
cd workers/ffmpeg-worker
npm run build
# Deploy no Railway ou Render
```

## Licença

MIT
