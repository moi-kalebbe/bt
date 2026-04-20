import {
  countPublishedWithoutMetaMediaId,
  getDashboardStats,
  getTopPosts,
  getPerformanceBySlot,
  getPerformanceByDuration,
} from '@/infra/supabase/repositories/instagram-metrics.repository';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ niche?: string }>;
}

const SLOT_LABELS: Record<string, string> = {
  morning: '🌅 Manhã (08:00)',
  midday:  '☀️ Meio-dia (11:30)',
  evening: '🌇 Tarde (18:00)',
  night:   '🌙 Noite (21:30)',
  unknown: '❓ Sem slot',
};

export default async function IntelligencePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const niche = params.niche ?? 'beach-tennis';

  const [stats, topPosts, bySlot, byDuration, unavailableCount] = await Promise.all([
    getDashboardStats(niche),
    getTopPosts(niche, 10),
    getPerformanceBySlot(niche),
    getPerformanceByDuration(niche),
    countPublishedWithoutMetaMediaId(niche, 24),
  ]);

  const hasData = stats.totalAnalyzed > 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold">Inteligência de Postagem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas reais do Instagram coletadas pós-publicação — alimentam o agendamento automático.
        </p>
      </div>

      {unavailableCount > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {unavailableCount} post{unavailableCount > 1 ? 's' : ''} publicado{unavailableCount > 1 ? 's' : ''} no Instagram ainda sem Meta ID vÃ¡lido para coletar insights.
        </div>
      )}

      {!hasData && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="font-semibold">Nenhuma métrica coletada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em &quot;Coletar Insights&quot; na tela de Vídeos após publicar posts há mais de 24h.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Posts analisados" value={String(stats.totalAnalyzed)} />
            <StatCard
              label="Engajamento médio"
              value={`${(stats.avgEngagementRate * 100).toFixed(2)}%`}
              sub="likes+comments+shares+saves / reach"
            />
            <StatCard
              label="Alcance total"
              value={formatNum(stats.totalReach)}
              sub="soma de todos os posts"
            />
            <StatCard
              label="Alcance médio"
              value={formatNum(stats.avgReach)}
              sub="por post"
            />
          </div>

          {/* Top posts */}
          <section>
            <h2 className="text-sm font-semibold mb-2">Top {topPosts.length} posts por engajamento</h2>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Autor</th>
                    <th className="text-left px-3 py-2 hidden sm:table-cell">Slot</th>
                    <th className="text-left px-3 py-2 hidden sm:table-cell">Dur.</th>
                    <th className="text-right px-3 py-2">Alcance</th>
                    <th className="text-right px-3 py-2">Plays</th>
                    <th className="text-right px-3 py-2">Eng.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topPosts.map((post, i) => (
                    <tr key={post.content_item_id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 max-w-[120px]">
                        <div className="font-medium truncate">@{post.author_username ?? '—'}</div>
                        <div className="text-muted-foreground truncate">{post.title?.slice(0, 40) ?? ''}</div>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                        {post.selected_for_slot ? SLOT_LABELS[post.selected_for_slot]?.split(' ')[0] : '—'}
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                        {post.duration_seconds ? `${post.duration_seconds}s` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">{post.reach != null ? formatNum(post.reach) : '—'}</td>
                      <td className="px-3 py-2 text-right">{post.plays != null ? formatNum(post.plays) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">
                        {post.engagement_rate != null
                          ? `${(Number(post.engagement_rate) * 100).toFixed(2)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* By slot */}
            {bySlot.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-2">Performance por horário</h2>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Horário</th>
                        <th className="text-right px-3 py-2">Posts</th>
                        <th className="text-right px-3 py-2">Alcance médio</th>
                        <th className="text-right px-3 py-2">Eng. médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bySlot.map((row, i) => (
                        <tr key={row.slot} className={i === 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'}>
                          <td className="px-3 py-2">{SLOT_LABELS[row.slot] ?? row.slot}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{row.count}</td>
                          <td className="px-3 py-2 text-right">{formatNum(row.avgReach)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">
                            {(row.avgEngagementRate * 100).toFixed(2)}%
                            {i === 0 && <span className="ml-1 text-emerald-500">★</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* By duration */}
            {byDuration.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-2">Performance por duração</h2>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Duração</th>
                        <th className="text-right px-3 py-2">Posts</th>
                        <th className="text-right px-3 py-2">Alcance médio</th>
                        <th className="text-right px-3 py-2">Eng. médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {byDuration.map((row, i) => (
                        <tr key={row.bucket} className={i === 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'}>
                          <td className="px-3 py-2 font-medium">{row.bucket}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{row.count}</td>
                          <td className="px-3 py-2 text-right">{formatNum(row.avgReach)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">
                            {(row.avgEngagementRate * 100).toFixed(2)}%
                            {i === 0 && <span className="ml-1 text-emerald-500">★</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            ★ Melhor performance · Dados atualizados ao clicar em &quot;Coletar Insights&quot; na tela de Vídeos.
            O agendamento automático usa score híbrido: 40% engajamento da fonte + 60% performance real do Instagram.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
