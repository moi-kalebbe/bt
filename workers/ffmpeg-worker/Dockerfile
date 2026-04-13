FROM node:20-slim

# Instalar FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependências (inclui devDependencies para o build)
COPY package.json package-lock.json* ./
RUN npm install

# Copiar código e compilar
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remover devDependencies após o build
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/index.js"]
