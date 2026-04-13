# PRD — Beach Tennis Video Pipeline

## Visão do produto
Sistema para encontrar vídeos recentes de beach tennis em TikTok e YouTube Shorts, excluir autores bloqueados, baixar os arquivos e metadados, armazenar no Cloudflare R2, indexar no Supabase, exibir em uma galeria administrativa, reprocessar com trilha de fundo via FFmpeg e publicar em janelas programadas.

## Objetivo principal
Transformar descoberta e reaproveitamento operacional de vídeos curtos em um pipeline automatizado e rastreável.

## Problema que o sistema resolve
- descoberta manual consome tempo
- conteúdos se perdem sem organização
- falta rastreabilidade entre origem, processamento e publicação
- ausência de fila e status dificulta escala

## Resultado esperado
- pipeline confiável de ponta a ponta
- galeria com preview e status
- separação clara entre original e processado
- prevenção de duplicidade
- operação por lotes e horários definidos

## Fontes
- TikTok
- YouTube Shorts

## Regras principais
- nicho inicial: beach tennis
- excluir autores: `btrobson`, `raphael.bt`
- armazenar vídeo, título, descrição, autor, hashtags e payload bruto
- manhã: selecionar 1 vídeo
- noite: selecionar 1 vídeo
- status completos do ciclo de vida

## Usuários do sistema
### Operador/admin
- visualiza galeria
- ajusta blacklist
- revisa falhas
- acompanha publicação

### Worker/automação
- coleta
- filtra
- faz upload
- processa
- publica

## Requisitos funcionais
1. Buscar vídeos recentes por consulta configurável.
2. Normalizar metadados de múltiplas plataformas.
3. Excluir autores da blacklist.
4. Detectar duplicidade.
5. Baixar vídeo e thumbnail.
6. Fazer upload para R2.
7. Salvar e atualizar registros no Supabase.
8. Exibir galeria com filtros.
9. Selecionar vídeos por janela operacional.
10. Processar mídia com FFmpeg.
11. Publicar nos destinos autorizados.
12. Registrar logs e erros.

## Requisitos não funcionais
- idempotência
- escalabilidade modular
- logs por etapa
- retries com backoff
- separação entre raw e processed
- fácil expansão para novos nichos

## Status do domínio
- discovered
- filtered_out
- downloaded
- uploaded_r2
- ready
- scheduled
- processing
- published
- failed
- ignored_duplicate

## Fases
### Fase 1
- schema, R2, ingestão, galeria básica

### Fase 2
- filas, FFmpeg, trilhas, logs

### Fase 3
- publicação e agendamento

### Fase 4
- score automático e métricas operacionais
