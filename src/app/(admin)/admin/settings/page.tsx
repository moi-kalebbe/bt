import { findBlockedAuthors, createBlockedAuthor, deleteBlockedAuthor } from '@/infra/supabase/repositories/blocked-authors.repository';
import { supabase } from '@/infra/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [blockedAuthors, publishTargets] = await Promise.all([
    findBlockedAuthors(),
    supabase.from('publish_targets').select().eq('active', true),
  ]);

  const targets = publishTargets.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div>
            <h1 className="text-xl font-bold">Beach Tennis Pipeline</h1>
            <p className="text-sm text-muted-foreground">Configurações</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Autores Bloqueados</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={async (formData) => {
                  'use server';
                  const source = formData.get('source') as string;
                  const username = formData.get('username') as string;
                  const reason = formData.get('reason') as string;

                  if (source && username) {
                    await createBlockedAuthor({
                      source: source as 'tiktok' | 'youtube',
                      username,
                      reason,
                    });
                    revalidatePath('/admin/settings');
                  }
                }}
                className="mb-4 flex gap-2"
              >
                <select
                  name="source"
                  aria-label="Fonte do autor"
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Fonte</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
                <Input
                  name="username"
                  placeholder="Nome de usuário"
                  required
                  className="flex-1"
                />
                <Input
                  name="reason"
                  placeholder="Motivo (opcional)"
                  className="w-48"
                />
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>

              <div className="space-y-2">
                {blockedAuthors.map((author) => (
                  <div
                    key={author.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{author.source}</Badge>
                      <span className="font-mono text-sm">
                        @{author.username}
                      </span>
                      {author.reason && (
                        <span className="text-xs text-muted-foreground">
                          ({author.reason})
                        </span>
                      )}
                    </div>
                    <form
                      action={async () => {
                        'use server';
                        await deleteBlockedAuthor(author.id);
                        revalidatePath('/admin/settings');
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                ))}
                {blockedAuthors.length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">
                    Nenhum autor bloqueado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Destinos de Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {targets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div>
                      <Badge
                        variant={
                          target.platform === 'instagram'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {target.platform}
                      </Badge>
                      <span className="ml-2 font-medium">
                        {target.account_name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {target.account_identifier}
                    </span>
                  </div>
                ))}
                {targets.length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">
                    Nenhum destino configurado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variáveis de Ambiente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SUPABASE_URL:</span>
                  <span className="truncate">
                    {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">R2:</span>
                  <span className="truncate">
                    {process.env.R2_BUCKET_NAME ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UPSTASH_REDIS:</span>
                  <span className="truncate">
                    {process.env.UPSTASH_REDIS_REST_URL ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">APIFY:</span>
                  <span className="truncate">
                    {process.env.APIFY_TOKEN ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
