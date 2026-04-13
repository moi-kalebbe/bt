# Pipeline Operacional

## Fluxo 1 — Descoberta
1. Rodar scraper TikTok
2. Rodar scraper YouTube Shorts
3. Normalizar os dados
4. Aplicar blacklist
5. Aplicar deduplicação
6. Persistir candidatos

## Fluxo 2 — Ingestão
1. Selecionar itens aprovados
2. Baixar vídeo e thumb
3. Subir vídeo e thumb para R2
4. Atualizar registro
5. Marcar item como `ready`

## Fluxo 3 — Seleção
1. Buscar itens `ready`
2. Escolher 1 item manhã
3. Escolher 1 item noite
4. Criar jobs
5. Marcar como `scheduled`

## Fluxo 4 — Processamento
1. Baixar original
2. Baixar trilha escolhida
3. Processar no FFmpeg
4. Subir versão processada
5. Atualizar `processed_video_r2_key`

## Fluxo 5 — Publicação
1. Buscar job agendado
2. Validar credenciais do destino
3. Publicar
4. Salvar resposta
5. Atualizar status

## Tratamento de falhas
- retry com backoff
- campo de erro persistido
- limite de tentativas
- reprocessamento manual
