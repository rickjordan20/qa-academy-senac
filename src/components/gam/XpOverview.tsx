import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LEVELS,
  levelFor,
  pendingXp,
  sumXp,
  useBadgeCatalog,
  useGamActions,
  useGroupXpEvents,
  useMyBadges,
  useMyXpEvents,
  useSyncGamification,
  actionLabel,
  type XpEvent,
} from "@/lib/gamification";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

export function XpOverview({ userId, groupIds }: { userId: string | null; groupIds: string[] }) {
  const { data: stats } = useSyncGamification(userId);
  const { data: events } = useMyXpEvents(userId);
  const { data: teamEvents } = useGroupXpEvents(groupIds);
  const { data: catalog } = useBadgeCatalog();
  const { data: mine } = useMyBadges(userId);
  const { data: actions } = useGamActions();

  const totalXp = sumXp(events, () => true);
  const techXp = sumXp(events, (e) => e.context === "techeduca");
  const cafeXp = sumXp(events, (e) => e.context === "cafe");
  const teamXp = sumXp(teamEvents, () => true);
  const pending = pendingXp(events);
  const teamPending = pendingXp(teamEvents);
  const lvl = levelFor(totalXp);
  const owned = new Set((mine ?? []).map((b) => b.badge_code));

  const recent: XpEvent[] = (events ?? []).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">XP e nível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold">{totalXp} XP</span>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
                {lvl.current.name}
              </span>
              {pending > 0 && (
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {pending} XP pendente de validação
                </span>
              )}
            </div>
            <div className="mt-3">
              <Progress value={lvl.progress} />
              <p className="mt-2 text-xs text-muted-foreground">
                {lvl.next
                  ? `Próxima evolução: ${lvl.next.name} — faltam ${lvl.remaining} XP`
                  : "Nível máximo alcançado"}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1 text-xs text-muted-foreground">
              {LEVELS.map((l) => (
                <span
                  key={l.name}
                  className={`rounded-md border border-border px-2 py-0.5 ${
                    l.name === lvl.current.name ? "bg-secondary text-foreground" : ""
                  }`}
                >
                  {l.name} · {l.min}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">XP por trilha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs uppercase tracking-wide text-accent">TechEduca</div>
              <div className="font-semibold">{techXp} XP individual</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs uppercase tracking-wide text-accent">Café Central</div>
              <div className="font-semibold">{cafeXp} XP individual</div>
              <div className="font-semibold">{teamXp} XP coletivo</div>
              {teamPending > 0 && (
                <div className="text-xs text-muted-foreground">
                  {teamPending} XP coletivo pendente
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Minha atividade</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Missões" value={stats?.missions ?? 0} />
          <Stat label="Casos de teste" value={stats?.cases ?? 0} />
          <Stat label="Execuções" value={stats?.executions ?? 0} />
          <Stat label="Bugs" value={stats?.bugs ?? 0} />
          <Stat label="Evidências" value={stats?.evidences ?? 0} />
          <Stat label="Retestes" value={stats?.retests ?? 0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Badges ({owned.size}/{catalog?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(catalog ?? []).map((b) => {
            const has = owned.has(b.code);
            return (
              <div
                key={b.code}
                className={`rounded-lg border p-3 ${
                  has ? "border-accent bg-secondary" : "border-border opacity-60"
                }`}
              >
                <div className="text-sm font-semibold">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.description}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {has ? "Conquistada" : `Critério: ${b.criteria}`}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">XP recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recent.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2"
              >
                <span>{actionLabel(actions, e.action_code)}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{e.context === "cafe" ? "Café Central" : "TechEduca"}</span>
                  <span className="rounded-md border border-border px-2 py-0.5">
                    {e.status === "pending" ? "pendente" : e.status === "rejected" ? "não validado" : "validado"}
                  </span>
                  <span className="font-semibold text-foreground">+{e.xp} XP</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
