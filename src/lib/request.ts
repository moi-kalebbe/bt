import type { NextRequest } from 'next/server';

/**
 * Lê o body da request uma única vez e tenta parsear como JSON ou form-urlencoded.
 * Evita o bug de request.json() consumir o stream antes de request.text().
 */
export async function parseBody(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}
