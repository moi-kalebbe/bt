# Prompt Mestre para IA Coder

Você vai construir um sistema chamado Beach Tennis Video Pipeline.

## Objetivo
Criar um sistema full-stack para:
- coletar vídeos recentes de beach tennis de TikTok e YouTube Shorts
- excluir autores bloqueados (`btrobson`, `raphael.bt`)
- baixar vídeo, thumbnail e metadados
- enviar arquivos para Cloudflare R2
- salvar registros estruturados no Supabase
- exibir uma galeria administrativa com filtros e status
- selecionar um vídeo pela manhã e um à noite
- reprocessar com FFmpeg adicionando trilha de fundo discreta
- publicar nos destinos conectados
- manter logs e idempotência

## Regras obrigatórias
- use TypeScript
- separe domínio, infra e app
- preserve payload bruto do scraper
- use filas para ingestão, processamento e publicação
- use status explícitos do domínio
- trate deduplicação por source_video_id e hash
- use arquitetura preparada para múltiplos nichos no futuro

## Entregas esperadas
1. estrutura de pastas
2. schema SQL
3. integração R2
4. integração Supabase
5. clients do Apify
6. processamento FFmpeg
7. painel admin
8. workers
9. testes das partes críticas

## Ordem de construção
1. domínio e banco
2. storage
3. coleta
4. ingestão
5. galeria
6. processamento
7. publicação

## Qualidade esperada
- código limpo
- comentários apenas onde fizer sentido
- funções pequenas
- tipos fortes
- tratamento de erro consistente
- logs úteis
