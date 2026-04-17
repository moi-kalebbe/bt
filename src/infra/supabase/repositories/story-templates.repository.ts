import { getSupabaseClient } from '@/infra/supabase/client';
import type { StoryTemplate, StoryTemplateConfig } from '@/types/story-template';
import { DEFAULT_TEMPLATES_PER_NICHE } from '@/app/(admin)/admin/settings/template-defaults';

function rowToTemplate(row: {
  id: string;
  niche: string;
  slot: number;
  name: string;
  config: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): StoryTemplate {
  return {
    id: row.id,
    niche: row.niche,
    slot: row.slot as 1 | 2 | 3,
    name: row.name,
    config: row.config as StoryTemplateConfig,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function seedDefaultTemplates(niche: string): Promise<void> {
  const client = getSupabaseClient();
  const rows = DEFAULT_TEMPLATES_PER_NICHE.map((t) => ({
    niche,
    slot: t.slot,
    name: t.name,
    config: t.config,
    is_active: true,
  }));

  await client
    .from('story_templates')
    .upsert(rows, { onConflict: 'niche,slot', ignoreDuplicates: true });
}

export async function getTemplatesForNiche(niche: string): Promise<StoryTemplate[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('story_templates')
    .select('*')
    .eq('niche', niche)
    .order('slot', { ascending: true });

  if (error) throw new Error(`story_templates fetch failed: ${error.message}`);

  if (!data || data.length === 0) {
    await seedDefaultTemplates(niche);
    const { data: seeded } = await client
      .from('story_templates')
      .select('*')
      .eq('niche', niche)
      .order('slot', { ascending: true });
    return (seeded ?? []).map(rowToTemplate);
  }

  return data.map(rowToTemplate);
}

export async function getActiveTemplatesForNiche(niche: string): Promise<StoryTemplate[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('story_templates')
    .select('*')
    .eq('niche', niche)
    .eq('is_active', true)
    .order('slot', { ascending: true });

  if (error) throw new Error(`story_templates fetch failed: ${error.message}`);
  return (data ?? []).map(rowToTemplate);
}

export async function getRandomActiveTemplate(niche: string): Promise<StoryTemplate | null> {
  const templates = await getActiveTemplatesForNiche(niche);
  if (templates.length === 0) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function upsertTemplate(
  niche: string,
  slot: 1 | 2 | 3,
  data: { name: string; config: StoryTemplateConfig; is_active: boolean }
): Promise<StoryTemplate> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: row, error } = await client
    .from('story_templates')
    .upsert(
      { niche, slot, name: data.name, config: data.config, is_active: data.is_active, updated_at: now },
      { onConflict: 'niche,slot' }
    )
    .select()
    .single();

  if (error || !row) throw new Error(`upsertTemplate failed: ${error?.message}`);
  return rowToTemplate(row);
}

export async function toggleTemplateActive(
  niche: string,
  slot: 1 | 2 | 3,
  is_active: boolean
): Promise<StoryTemplate> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: row, error } = await client
    .from('story_templates')
    .update({ is_active, updated_at: now })
    .eq('niche', niche)
    .eq('slot', slot)
    .select()
    .single();

  if (error || !row) throw new Error(`toggleTemplateActive failed: ${error?.message}`);
  return rowToTemplate(row);
}
