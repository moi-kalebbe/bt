import { findBlockedAuthors, createBlockedAuthor, deleteBlockedAuthor } from '@/infra/supabase/repositories/blocked-authors.repository';
import { getAllNicheSettings, upsertNicheSettings } from '@/infra/supabase/repositories/niche-settings.repository';
import { getTemplatesForNiche } from '@/infra/supabase/repositories/story-templates.repository';
import { NICHES } from '@/config/niches';
import { TemplateEditorSection } from './template-editor-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const ENV_CHECKS = [
  { label: 'Supabase URL',      key: 'NEXT_PUBLIC_SUPABASE_URL' },
  { label: 'R2 Bucket',         key: 'R2_BUCKET_NAME' },
  { label: 'Zernio API Key',    key: 'ZERNIO_API_KEY' },
  { label: 'Groq API Key',      key: 'GROQ_API_KEY' },
  { label: 'Firecrawl API Key', key: 'FIRECRAWL_API_KEY' },
  { label: 'Cron Secret',       key: 'CRON_SECRET' },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string }>;
}) {
  const { niche: nicheParam } = await searchParams;
  const currentNiche = nicheParam ?? 'beach-tennis';

  const [blockedAuthors, nicheSettingsList, templates] = await Promise.all([
    findBlockedAuthors(undefined, currentNiche),
    getAllNicheSettings().catch(() => []),
    getTemplatesForNiche(currentNiche).catch(() => []),
  ]);

  const settingsMap = Object.fromEntries(nicheSettingsList.map((s) => [s.niche_id, s]));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie contas, autores, destinos e variáveis de ambiente</p>
      </div>

      {/* ── Contas por Nicho ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold mb-3">Contas por Nicho</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {NICHES.map((niche) => {
            const s = settingsMap[niche.id];
            return (
              <Card key={niche.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{niche.icon}</span>
                    {niche.label}
                  </CardTitle>
                  <CardDescription>Meta, Zernio e handles de legenda</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    action={async (formData: FormData) => {
                      'use server';
                      const nicheId = formData.get('niche_id') as string;
                      const apifyTokenRaw = (formData.get('apify_token') as string).trim();
                      const metaToken = (formData.get('meta_access_token') as string).trim();
                      const metaAccountId = (formData.get('meta_instagram_account_id') as string).trim();
                      const firecrawlKey = (formData.get('firecrawl_api_key') as string).trim();
                      await upsertNicheSettings(nicheId, {
                        zernio_instagram_id: (formData.get('zernio_instagram_id') as string) || null,
                        zernio_tiktok_id:    (formData.get('zernio_tiktok_id')    as string) || null,
                        zernio_youtube_id:   (formData.get('zernio_youtube_id')   as string) || null,
                        zernio_facebook_id:  (formData.get('zernio_facebook_id')  as string) || null,
                        caption_account_handle: (formData.get('caption_account_handle') as string) || null,
                        caption_account_tag:    (formData.get('caption_account_tag')    as string) || null,
                        apify_token: apifyTokenRaw || null,
                        meta_access_token: metaToken || null,
                        meta_instagram_account_id: metaAccountId || null,
                        firecrawl_api_key: firecrawlKey || null,
                      });
                      revalidatePath('/admin/settings');
                    }}
                    className="space-y-3"
                  >
                    <input type="hidden" name="niche_id" value={niche.id} />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Apify</p>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Token</span>
                        <Input
                          name="apify_token"
                          type="password"
                          defaultValue={s?.apify_token ?? ''}
                          placeholder={s?.apify_token ? '••••••••' : 'apify_api_...'}
                          className="h-8 text-xs font-mono"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Firecrawl (Notícias)</p>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">API Key</span>
                        <Input
                          name="firecrawl_api_key"
                          type="password"
                          defaultValue={s?.firecrawl_api_key ?? ''}
                          placeholder={s?.firecrawl_api_key ? '••••••••' : 'fc-...'}
                          className="h-8 text-xs font-mono"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meta (Instagram oficial)</p>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Account ID</span>
                        <Input
                          name="meta_instagram_account_id"
                          defaultValue={s?.meta_instagram_account_id ?? ''}
                          placeholder="17841400000000000"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Token</span>
                        <Input
                          name="meta_access_token"
                          type="password"
                          defaultValue={s?.meta_access_token ?? ''}
                          placeholder={s?.meta_access_token ? '••••••••' : 'EAABwzLixnjYB...'}
                          className="h-8 text-xs font-mono"
                          autoComplete="new-password"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Prioridade sobre Zernio para Instagram (50 posts/dia). Token expira em 60 dias.
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zernio</p>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Instagram</span>
                        <Input name="zernio_instagram_id" defaultValue={s?.zernio_instagram_id ?? ''} placeholder="ID da conta" className="h-8 text-xs font-mono" />
                      </div>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">TikTok</span>
                        <Input name="zernio_tiktok_id" defaultValue={s?.zernio_tiktok_id ?? ''} placeholder="ID da conta" className="h-8 text-xs font-mono" />
                      </div>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">YouTube</span>
                        <Input name="zernio_youtube_id" defaultValue={s?.zernio_youtube_id ?? ''} placeholder="ID da conta" className="h-8 text-xs font-mono" />
                      </div>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Facebook</span>
                        <Input name="zernio_facebook_id" defaultValue={s?.zernio_facebook_id ?? ''} placeholder="ID da conta" className="h-8 text-xs font-mono" />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Legenda</p>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Handle</span>
                        <Input name="caption_account_handle" defaultValue={s?.caption_account_handle ?? ''} placeholder="@conta" className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-muted-foreground">Hashtag</span>
                        <Input name="caption_account_tag" defaultValue={s?.caption_account_tag ?? ''} placeholder="#hashtag" className="h-8 text-xs" />
                      </div>
                    </div>

                    <Button type="submit" size="sm" className="w-full h-8 text-xs">
                      Salvar {niche.label}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <TemplateEditorSection niche={currentNiche} initialTemplates={templates} />

      {/* ── Autores Bloqueados (por nicho) ───────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Autores Bloqueados
              <Badge variant="outline" className="text-xs font-normal">
                {NICHES.find(n => n.id === currentNiche)?.icon}{' '}
                {NICHES.find(n => n.id === currentNiche)?.label}
              </Badge>
            </CardTitle>
            <CardDescription>
              Autores do nicho <strong>{NICHES.find(n => n.id === currentNiche)?.label}</strong> cujos vídeos serão ignorados durante a coleta.
              Troque o nicho no seletor do topo para gerenciar outros nichos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={async (formData: FormData) => {
                'use server';
                const source = formData.get('source') as string;
                const username = formData.get('username') as string;
                const reason = formData.get('reason') as string;
                const niche = formData.get('niche') as string;
                if (source && username) {
                  await createBlockedAuthor({ source: source as 'tiktok' | 'youtube', username, reason, niche });
                  revalidatePath('/admin/settings');
                }
              }}
              className="flex gap-2 flex-wrap"
            >
              <input type="hidden" name="niche" value={currentNiche} />
              <select
                name="source"
                aria-label="Fonte"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Fonte</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>
              <Input name="username" placeholder="@usuário" required className="flex-1 min-w-28 h-9" />
              <Input name="reason" placeholder="Motivo (opcional)" className="flex-1 min-w-28 h-9" />
              <Button type="submit" size="sm" className="h-9">
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            <Separator />

            <div className="space-y-2">
              {blockedAuthors.map((author) => (
                <div key={author.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">{author.source}</Badge>
                    <span className="font-mono truncate">@{author.username}</span>
                    {author.reason && (
                      <span className="text-xs text-muted-foreground truncate hidden sm:block">({author.reason})</span>
                    )}
                  </div>
                  <form action={async () => {
                    'use server';
                    await deleteBlockedAuthor(author.id);
                    revalidatePath('/admin/settings');
                  }}>
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              ))}
              {blockedAuthors.length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Nenhum autor bloqueado para {NICHES.find(n => n.id === currentNiche)?.label}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Variáveis de Ambiente */}
        <Card>
          <CardHeader>
            <CardTitle>Variáveis de Ambiente</CardTitle>
            <CardDescription>Credenciais globais do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ENV_CHECKS.map(({ label, key }) => {
                const ok = !!process.env[key];
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
