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

const SLOT_SHORT: Record<string, string> = {
  morning: 'Manhã · 08:00',
  midday:  'Meio-dia · 11:30',
  evening: 'Tarde · 18:00',
  night:   'Noite · 21:30',
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

  // Derived insights
  const bestSlot     = bySlot[0] ?? null;
  const worstSlot    = bySlot.length > 1 ? bySlot[bySlot.length - 1] : null;
  const bestDuration = byDuration[0] ?? null;
  const avgEng       = stats.avgEngagementRate;

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const lift = (a: number) => avgEng > 0 ? Math.round((a - avgEng) / avgEng * 100) : 0;

  const bestSlotLift     = bestSlot     ? lift(bestSlot.avgEngagementRate)     : 0;
  const worstSlotDrop    = worstSlot    ? lift(worstSlot.avgEngagementRate)    : 0;
  const bestDurationLift = bestDuration ? lift(bestDuration.avgEngagementRate) : 0;

  const slotSpread = bestSlot && worstSlot
    ? bestSlot.avgEngagementRate - worstSlot.avgEngagementRate
    : 0;

  const engHealth    = avgEng >= 0.05 ? 'great' : avgEng >= 0.03 ? 'good' : avgEng >= 0.01 ? 'ok' : 'bad';
  const sampleHealth = stats.totalAnalyzed >= 30 ? 'great' : stats.totalAnalyzed >= 15 ? 'good' : 'small';

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Inteligência de Postagem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas reais do Instagram coletadas pós-publicação — alimentam o agendamento automático.
        </p>
      </div>

      {unavailableCount > 0 && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          ⚠️ {unavailableCount} post{unavailableCount > 1 ? 's' : ''} publicado{unavailableCount > 1 ? 's' : ''} no Instagram ainda sem Meta ID válido para coletar insights.
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
          {/* ── RECOMENDAÇÕES ─────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader
              icon="🎯"
              title="Recomendações para hoje"
              sub={`baseado em ${stats.totalAnalyzed} posts analisados`}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              {bestSlot && (
                <RecoCard
                  color="emerald"
                  badge="Melhor horário"
                  title={SLOT_SHORT[bestSlot.slot] ?? bestSlot.slot}
                  stat={pct(bestSlot.avgEngagementRate) + ' eng.'}
                  lift={bestSlotLift > 0 ? `+${bestSlotLift}% vs média` : undefined}
                  tip="Priorize esse slot no agendador"
                />
              )}

              {bestDuration && (
                <RecoCard
                  color="blue"
                  badge="Melhor duração"
                  title={bestDuration.bucket}
                  stat={pct(bestDuration.avgEngagementRate) + ' eng.'}
                  lift={bestDurationLift > 0 ? `+${bestDurationLift}% vs média` : undefined}
                  tip="Filtre vídeos dessa duração no pipeline"
                />
              )}

              {worstSlot && worstSlotDrop <= -8 ? (
                <RecoCard
                  color="red"
                  badge="Evitar horário"
                  title={SLOT_SHORT[worstSlot.slot] ?? worstSlot.slot}
                  stat={pct(worstSlot.avgEngagementRate) + ' eng.'}
                  lift={`${worstSlotDrop}% vs média`}
                  tip="Desative esse slot temporariamente"
                />
              ) : (
                <RecoCard
                  color="violet"
                  badge="Distribuição"
                  title="Balanceada"
                  stat="Todos os horários performam"
                  tip="Continue testando todos os slots"
                />
              )}
            </div>
          </section>

          {/* ── DIAGNÓSTICO ───────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader icon="🩺" title="Diagnóstico do canal" />

            <div className="grid gap-2 sm:grid-cols-2">
              <DiagItem
                icon={engHealth === 'great' ? '✅' : engHealth === 'good' ? '🟡' : '⚠️'}
                label="Engajamento médio"
                value={pct(avgEng)}
                note={
                  engHealth === 'great' ? 'Excelente — acima de 5%, canal muito engajado' :
                  engHealth === 'good'  ? 'Bom — acima de 3%, dentro do esperado' :
                  engHealth === 'ok'    ? 'Fraco — abaixo de 3%, revise seleção de conteúdo' :
                                         'Crítico — abaixo de 1%, mude a estratégia'
                }
              />

              <DiagItem
                icon={sampleHealth === 'great' ? '✅' : sampleHealth === 'good' ? '🟡' : '🔵'}
                label="Amostra de dados"
                value={`${stats.totalAnalyzed} posts`}
                note={
                  sampleHealth === 'great' ? 'Boa amostra — resultados estatisticamente confiáveis' :
                  sampleHealth === 'good'  ? 'Amostra razoável — colete mais para maior precisão' :
                                             'Amostra pequena — continue postando para calibrar'
                }
              />

              {bestSlot && worstSlot && (
                <DiagItem
                  icon="📊"
                  label="Variação entre horários"
                  value={`${(slotSpread * 100).toFixed(2)}pp`}
                  note={
                    slotSpread > 0.025
                      ? 'Alta — horário é fator decisivo no seu canal'
                      : slotSpread > 0.01
                      ? 'Moderada — horário tem impacto relevante'
                      : 'Baixa — conteúdo importa mais que horário aqui'
                  }
                />
              )}

              {topPosts[0]?.engagement_rate != null && (
                <DiagItem
                  icon="🏆"
                  label="Melhor post publicado"
                  value={`${(Number(topPosts[0].engagement_rate) * 100).toFixed(2)}% eng.`}
                  note={[
                    topPosts[0].author_username ? `@${topPosts[0].author_username}` : null,
                    topPosts[0].duration_seconds ? `${topPosts[0].duration_seconds}s` : null,
                    topPosts[0].selected_for_slot ? (SLOT_SHORT[topPosts[0].selected_for_slot] ?? topPosts[0].selected_for_slot) : null,
                  ].filter(Boolean).join(' · ')}
                />
              )}
            </div>
          </section>

          {/* ── STAT CARDS ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Posts analisados" value={String(stats.totalAnalyzed)} />
            <StatCard
              label="Engajamento médio"
              value={pct(stats.avgEngagementRate)}
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

          {/* ── TOP POSTS ─────────────────────────────────────────── */}
          <section>
            <SectionHeader icon="📈" title={`Top ${topPosts.length} posts por engajamento`} />
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

          {/* ── BY SLOT / BY DURATION ─────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            {bySlot.length > 0 && (
              <section>
                <SectionHeader icon="🕗" title="Performance por horário" />
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
                            {pct(row.avgEngagementRate)}
                            {i === 0 && <span className="ml-1 text-emerald-500">★</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {byDuration.length > 0 && (
              <section>
                <SectionHeader icon="⏱" title="Performance por duração" />
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
                            {pct(row.avgEngagementRate)}
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

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
      <span>{icon}</span>
      {title}
      {sub && <span className="text-xs font-normal text-muted-foreground">({sub})</span>}
    </h2>
  );
}

type RecoColor = 'emerald' | 'blue' | 'red' | 'violet';

const COLOR_MAP: Record<RecoColor, { border: string; bg: string; badge: string; divider: string; lift: string }> = {
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', badge: 'text-emerald-400', divider: 'border-emerald-500/20', lift: 'text-emerald-400' },
  blue:    { border: 'border-blue-500/30',    bg: 'bg-blue-500/5',    badge: 'text-blue-400',    divider: 'border-blue-500/20',    lift: 'text-blue-400'    },
  red:     { border: 'border-red-500/30',     bg: 'bg-red-500/5',     badge: 'text-red-400',     divider: 'border-red-500/20',     lift: 'text-red-400'     },
  violet:  { border: 'border-violet-500/30',  bg: 'bg-violet-500/5',  badge: 'text-violet-400',  divider: 'border-violet-500/20',  lift: 'text-violet-400'  },
};

function RecoCard({ color, badge, title, stat, lift, tip }: {
  color: RecoColor;
  badge: string;
  title: string;
  stat: string;
  lift?: string;
  tip: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-1`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${c.badge}`}>{badge}</div>
      <div className="text-lg font-bold leading-tight">{title}</div>
      <div className="text-sm text-muted-foreground">
        {stat}
        {lift && <span className={`ml-1.5 ${c.lift}`}>{lift}</span>}
      </div>
      <div className={`text-xs text-muted-foreground pt-2 border-t ${c.divider}`}>
        💡 {tip}
      </div>
    </div>
  );
}

function DiagItem({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3">
      <span className="text-lg mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
      </div>
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
