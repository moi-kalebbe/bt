# Workers

## Filas sugeridas
- scrape
- ingest
- process
- publish

## Responsabilidades
### scrape worker
- chamar Apify
- normalizar retorno
- salvar candidatos

### ingest worker
- baixar mídia
- subir ao R2
- atualizar item

### process worker
- rodar FFmpeg
- subir versão processada
- registrar log

### publish worker
- enviar para destino conectado
- salvar resposta
