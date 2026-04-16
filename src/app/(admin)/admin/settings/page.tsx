import { findBlockedAuthors, createBlockedAuthor, deleteBlockedAuthor } from '@/infra/supabase/repositories/blocked-authors.repository';
import { supabase } from '@/infra/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const ENV_CHECKS = [
  { label: 'Supabase URL', key: 'NEXT_PUBLIC_SUPABASE_URL' },
  { label: 'R2 Bucket', key: 'R2_BUCKET_NAME' },
  { label: 'Upstash Redis', key: 'UPSTASH_REDIS_REST_URL' },
  { label: 'Apify Token', key: 'APIFY_TOKEN' },
  { label: 'Zernio API Key', key: 'ZERNIO_API_KEY' },
  { label: 'Cron Secret', key: 'CRON_SECRET' },
];

export default async function SettingsPage() {
  const [blockedAuthors, publishTargets] = await Promise.all([
    findBlockedAuthors(),
    supabase.from('publish_targets').select().eq('active', true),
  ]);

  const targets = publishTargets.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie autores, destinos e variáveis de ambiente</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Blocked Authors */}
        <Card>
          <CardHeader>
            <CardTitle>Autores Bloqueados</CardTitle>
            <CardDescription>Autores cujos vídeos serão ignorados durante a coleta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={async (formData) => {
                'use server';
                const source = formData.get('source') as string;
                const username = formData.get('username') as string;
                const reason = formData.get('reason') as string;
                if (source && username) {
                  await createBlockedAuthor({ source: source as 'tiktok' | 'youtube', username, reason });
                  revalidatePath('/admin/settings');
                }
              }}
              className="flex gap-2 flex-wrap"
            >
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
                <p className="py-3 text-center text-sm text-muted-foreground">Nenhum autor bloqueado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Publish Targets */}
        <Card>
          <CardHeader>
            <CardTitle>Destinos de Publicação</CardTitle>
            <CardDescription>Contas ativas para publicação automática</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {targets.map((target) => (
                <div key={target.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={target.platform === 'instagram' ? 'default' : 'secondary'}>
                      {target.platform}
                    </Badge>
                    <span className="font-medium truncate">{target.account_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-24 hidden sm:block">
                    {target.account_identifier}
                  </span>
                </div>
              ))}
              {targets.length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">Nenhum destino configurado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle>Variáveis de Ambiente</CardTitle>
            <CardDescription>Credenciais e configurações do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ENV_CHECKS.map(({ label, key }) => {
                const ok = !!process.env[key];
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={ok ? 'text-green-500' : 'text-destructive'}>
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </span>
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
