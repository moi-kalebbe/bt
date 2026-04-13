# Arquitetura do Sistema

## Componentes
### 1. Collector
Executa scrapers do Apify para TikTok e YouTube Shorts.

### 2. Normalizer
Converte dados de origens diferentes em um schema único.

### 3. Filter Engine
Aplica blacklist, recência, regras de qualidade e deduplicação.

### 4. Downloader
Baixa vídeo e thumbnail para armazenamento temporário.

### 5. Storage Manager
Faz upload de arquivos para o Cloudflare R2.

### 6. Metadata Manager
Atualiza o Supabase com informações estruturadas.

### 7. Processing Engine
Usa FFmpeg para gerar a versão processada.

### 8. Scheduler
Seleciona vídeos da manhã e da noite.

### 9. Publisher
Publica conteúdo nos destinos conectados.

### 10. Admin App
Galeria e operação manual.

## Fluxo macro
Coleta -> Normalização -> Filtro -> Download -> Upload R2 -> Supabase -> Galeria -> Seleção -> FFmpeg -> Publicação

## Armazenamento
### R2
- raw/source/yyyy/mm/dd/file.mp4
- processed/yyyy/mm/dd/id.mp4
- thumbs/source/yyyy/mm/dd/file.jpg

### Supabase
Responsável por:
- indexar metadados
- manter status
- armazenar payload bruto
- guardar histórico de publicação e erros

## Filas recomendadas
- scrape
- ingest
- process
- publish

## Locks recomendados
- lock por `source + source_video_id`
- lock por `content_item_id` em processamento
- lock por `publish_job_id`
