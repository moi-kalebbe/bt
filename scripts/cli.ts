#!/usr/bin/env node

import { createInterface } from 'readline';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ENV_PATH = join(process.cwd(), '.env.local');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, 'utf-8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^([^=\s#][^=]*)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    });
  }
  return env;
}

function saveEnv(env: Record<string, string>): void {
  const lines = Object.entries(env)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
}

function mask(value: string | undefined): string {
  if (!value || value.startsWith('your-') || value.startsWith('https://your')) return '(não configurado)';
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

async function askSection(
  title: string,
  fields: { key: string; label: string; hint?: string }[],
  env: Record<string, string>
): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(50));

  for (const field of fields) {
    if (field.hint) console.log(`  ${field.hint}`);
    const current = mask(env[field.key]);
    const answer = await question(`${field.label} [${current}]: `);
    if (answer) {
      env[field.key] = answer;
    }
  }
}

async function main() {
  console.log('\n🎾 Beach Tennis Pipeline — Configuração Completa\n');

  const env = loadEnv();

  // === Supabase ===
  await askSection('SUPABASE', [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'URL do Supabase', hint: 'Ex: https://xxxx.supabase.co' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key' },
  ], env);

  // === Cloudflare R2 ===
  await askSection('CLOUDFLARE R2', [
    { key: 'R2_ACCOUNT_ID', label: 'Account ID' },
    { key: 'R2_ACCESS_KEY_ID', label: 'Access Key ID' },
    { key: 'R2_SECRET_ACCESS_KEY', label: 'Secret Access Key' },
    { key: 'R2_BUCKET_NAME', label: 'Bucket Name', hint: 'Nome do bucket R2 (ex: scraper)' },
    { key: 'NEXT_PUBLIC_R2_PUBLIC_URL', label: 'URL Pública do R2', hint: 'Ex: https://pub-XXXX.r2.dev' },
  ], env);

  // === Apify ===
  await askSection('APIFY — Scraping', [
    { key: 'APIFY_TOKEN', label: 'Apify Token', hint: 'Obtenha em: https://console.apify.com/account/integrations' },
    { key: 'APIFY_TIKTOK_ACTOR_ID', label: 'TikTok Actor ID', hint: 'Ex: clockworks/tiktok-scraper ou apify/tiktok-scraper' },
    { key: 'APIFY_YOUTUBE_SHORTS_ACTOR_ID', label: 'YouTube Shorts Actor ID', hint: 'Ex: apify/youtube-scraper' },
  ], env);

  // === FFmpeg Worker (VPS) ===
  await askSection('FFMPEG WORKER — VPS', [
    {
      key: 'FFMPEG_WORKER_URL',
      label: 'URL do FFmpeg Worker no VPS',
      hint: 'Ex: http://123.456.78.90:3001 ou https://ffmpeg.seudominio.com',
    },
  ], env);

  // === Meta / Instagram / Facebook ===
  await askSection('META — Instagram & Facebook', [
    {
      key: 'META_PAGE_ACCESS_TOKEN',
      label: 'Page Access Token',
      hint: 'Obtido no Meta Business Suite → Token de acesso da página',
    },
    {
      key: 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      label: 'Instagram Business Account ID',
      hint: 'ID numérico da conta de negócios do Instagram',
    },
    {
      key: 'FACEBOOK_PAGE_ID',
      label: 'Facebook Page ID',
      hint: 'ID numérico da página do Facebook',
    },
  ], env);

  // === Upstash Redis (opcional) ===
  console.log('\n' + '='.repeat(50));
  console.log('  UPSTASH REDIS (opcional — deixe em branco para ignorar)');
  console.log('='.repeat(50));
  console.log('  O sistema funciona sem Redis (modo síncrono).');
  console.log('  Configure apenas se quiser filas assíncronas.\n');

  const redisUrl = await question(`URL do Upstash Redis [${mask(env.UPSTASH_REDIS_REST_URL)}]: `);
  if (redisUrl) env.UPSTASH_REDIS_REST_URL = redisUrl;

  const redisToken = await question(`Token do Upstash Redis [${mask(env.UPSTASH_REDIS_REST_TOKEN)}]: `);
  if (redisToken) env.UPSTASH_REDIS_REST_TOKEN = redisToken;

  saveEnv(env);

  console.log('\n✅ Configuração salva em .env.local\n');
  console.log('Próximos passos:');
  console.log('  1. npm run setup:db    → criar tabelas no Supabase');
  console.log('  2. npm run dev         → iniciar servidor de desenvolvimento');
  console.log('  3. Acesse http://localhost:3000/admin para o painel');
  console.log('  4. No VPS: cd workers/ffmpeg-worker && docker compose up -d\n');

  rl.close();
}

main().catch((error) => {
  console.error('Erro:', error);
  rl.close();
  process.exit(1);
});
