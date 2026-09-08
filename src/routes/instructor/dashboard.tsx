import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAllSubmissions } from "@/lib/mission-submissions";
import { fmtMissionDateTimeShort } from "@/lib/mission-schedule";
import {
  usePendingXpQueue,
  useIndividualRanking,
  useTeamRanking,
} from "@/lib/gamification";
import {
  indicatorBreakdown,
  useInstructorOverview,
  SITUATION_ORDER,
  type OverviewStudent,
} from "@/lib/instructor-overview";

export const Route = createFileRoute("/instructor/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de acompanhamento | QA Academy" },
      {
        name: "description",
        content:
          "Acompanhe turmas, alunos em risco, entregas pendentes e indicadores I1–I6 da UC10 em um só lugar.",
      },
      { property: "og:title", content: "Painel de acompanhamento | QA Academy" },
      {
        property: "og:description",
        content: "Alunos em risco, pendências de avaliação e progresso da turma na UC10.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorDashboard,
});

function InstructorDashboard() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const { data: indicators } = useIndicators();
  const { data: submissions } = useAllSubmissions();
  const { data: pendingXp } = usePendingXpQueue();
  const { data: ranking } = useIndividualRanking(true);
  const { data: teamRanking } = useTeamRanking(true);

  const [classId, setClassId] = useState<string>("all");
  const allIds = useMemo(() => (classes ?? []).map((c) => c.id), [classes]);
  const scopedIds = classId === "all" ? allIds : [classId];

  const { data: overview, isLoading } = useInstructorOverview(
    scopedIds,
    indicators ?? undefined,
    submissions,
  );

  const students = overview?.students ?? [];
  const atRisk = [...students].filter((s) => s.flags.length > 0).sort((a, b) => b.score - a.score);
  const breakdown = indicatorBreakdown(indicators ?? [], overview?.evaluations ?? [], students);
  const openRecovery = (overview?.recoveries ?? []).filter((r) => r.status !== "concluido").length;
  const totals = overview?.totals;

  return (
    <div>
      <header className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Área do instrutor
        </span>
        <h1 className="mt-1 text-2xl font-bold">
          UC10 – Realizar testes nas aplicações desenvolvidas
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="class-filter" className="text-sm text-muted-foreground">
            Turma:
          </label>
          <select
            id="class-filter"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="all">Todas as turmas ({(classes ?? []).length})</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {(classes ?? []).length === 0 && (
        <Card className="mb-6">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Nenhuma turma cadastrada ainda.{" "}
            <Link to="/instructor/classes" className="text-primary underline">
              Criar a primeira turma
            </Link>
          </CardContent>
        </Card>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Alunos" value={totals?.students ?? 0} to="/instructor/students" />
        <Stat
          label="Aguardando avaliação"
          value={totals?.awaiting ?? 0}
          to="/instructor/submissions"
          tone={totals?.awaiting ? "urgent" : undefined}
        />
        <Stat
          label="Devolvidas p/ correção"
          value={(totals?.revision ?? 0) + (totals?.reeval ?? 0)}
          to="/instructor/submissions"
        />
        <Stat
          label="XP pendente"
          value={pendingXp?.length ?? 0}
          to="/instructor/gamification"
        />
        <Stat
          label="Sem nenhuma entrega"
          value={totals?.noDelivery ?? 0}
          tone={totals?.noDelivery ? "urgent" : undefined}
        />
        <Stat label="Prontos p/ resultado" value={totals?.readyToConfirm ?? 0} to="/instructor/final" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------- alunos em risco ------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Alunos que precisam de atenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && atRisk.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum sinal de risco no momento. Toda a turma está em dia.
              </p>
            )}
            {atRisk.slice(0, 12).map((s) => (
              <RiskRow key={`${s.classId}-${s.student.id}`} s={s} />
            ))}
            {atRisk.length > 12 && (
              <Link to="/instructor/students" className="block text-sm text-primary underline">
                Ver todos os {atRisk.length} alunos com sinais de risco
              </Link>
            )}
          </CardContent>
        </Card>

        {/* ----------------------- pendências do instrutor -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Precisa da sua atenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Pending
              label="Entregas aguardando avaliação"
              value={totals?.awaiting ?? 0}
              to="/instructor/submissions"
            />
            <Pending
              label="Reavaliações solicitadas"
              value={totals?.reeval ?? 0}
              to="/instructor/submissions"
            />
            <Pending label="XP aguardando aprovação" value={pendingXp?.length ?? 0} to="/instructor/gamification" />
            <Pending label="Planos de recuperação em aberto" value={openRecovery} to="/instructor/recovery" />
            <Pending
              label="Resultados prontos para confirmar"
              value={totals?.readyToConfirm ?? 0}
              to="/instructor/final"
            />
            <Pending
              label="Alunos sem ciência da avaliação"
              value={students.filter((s) => !s.acknowledged).length}
              to="/instructor/students"
            />
          </CardContent>
        </Card>

        {/* --------------------------- indicadores ---------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Progresso da turma nos indicadores I1–I6</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {breakdown.map(({ ind, a, pa, na, none, total }) => (
              <div key={ind.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="mr-2 font-semibold text-primary">{ind.code}</span>
                    <span className="text-muted-foreground">{ind.description}</span>
                  </span>
                  <span className="flex flex-wrap gap-1 text-xs">
                    <Tag tone="bg-success text-success-foreground">A {a}</Tag>
                    <Tag tone="bg-warning text-warning-foreground">PA {pa}</Tag>
                    <Tag tone="bg-danger text-danger-foreground">NA {na}</Tag>
                    <Tag tone="border border-border text-muted-foreground">Não avaliado {none}</Tag>
                  </span>
                </div>
                <div
                  className="flex h-2 overflow-hidden rounded-full bg-secondary"
                  role="img"
                  aria-label={`${ind.code}: ${a} atendidos, ${pa} parciais, ${na} não atendidos, ${none} sem avaliação de ${total} alunos`}
                >
                  <Bar value={a} total={total} className="bg-success" />
                  <Bar value={pa} total={total} className="bg-warning" />
                  <Bar value={na} total={total} className="bg-danger" />
                </div>
              </div>
            ))}
            {breakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem indicadores carregados.</p>
            )}
          </CardContent>
        </Card>

        {/* ------------------------ situação da UC ---------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Situação na UC10</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {SITUATION_ORDER.map((s) => {
              const n = students.filter((st) => st.situation.key === s.key).length;
              if (!n) return null;
              return (
                <div key={s.key} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs ${s.tone}`}>{s.label}</span>
                  <span className="font-semibold">{n}</span>
                </div>
              );
            })}
            {students.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum aluno matriculado nesta visão.</p>
            )}
            <Link to="/instructor/reports" className="block pt-2 text-sm text-primary underline">
              Abrir relatórios
            </Link>
          </CardContent>
        </Card>

        {/* --------------------------- missões -------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Missões em andamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(overview?.missions ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma missão publicada e aberta.</p>
            )}
            {(overview?.missions ?? []).map((m) => {
              const pct = m.expected ? Math.round((m.delivered / m.expected) * 100) : 0;
              return (
                <Link
                  key={m.id}
                  to="/instructor/missions/$missionId"
                  params={{ missionId: m.id }}
                  className="block rounded-lg border border-border p-3 hover:border-primary"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{m.title}</span>
                    <span
                      className={`text-xs ${m.temporal === "overdue" ? "text-danger" : "text-muted-foreground"}`}
                    >
                      {m.temporal === "overdue" ? "Prazo vencido · " : "Prazo: "}
                      {fmtMissionDateTimeShort(m.dueAt, "due")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {m.delivered}/{m.expected} entregaram
                    </span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* ----------------------- engajamento (XP) --------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Engajamento (informativo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              XP e badges medem participação. Não definem A/PA/NA nem o resultado D/ND.
            </p>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Top alunos</p>
              {(ranking ?? []).slice(0, 5).map((r, i) => (
                <div key={r.student_id} className="flex justify-between border-b border-border py-1">
                  <span>
                    {i + 1}. {r.full_name}
                  </span>
                  <span className="font-semibold text-accent">{r.xp} XP</span>
                </div>
              ))}
              {(ranking ?? []).length === 0 && <p className="text-muted-foreground">Sem XP registrado.</p>}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Top equipes</p>
              {(teamRanking ?? []).slice(0, 5).map((r, i) => (
                <div key={r.group_id} className="flex justify-between border-b border-border py-1">
                  <span>
                    {i + 1}. {r.group_name}
                  </span>
                  <span className="font-semibold text-accent">{r.xp} XP</span>
                </div>
              ))}
              {(teamRanking ?? []).length === 0 && (
                <p className="text-muted-foreground">Sem XP coletivo registrado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------- turmas -------------------------------- */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Minhas turmas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(classes ?? []).map((c) => (
              <Link
                key={c.id}
                to="/instructor/classes/$classId"
                params={{ classId: c.id }}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.enrollments?.length ?? 0} alunos · {c.groups?.length ?? 0} grupos
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- componentes ----------------------------- */

function Stat({
  label,
  value,
  to,
  tone,
}: {
  label: string;
  value: number;
  to?: string;
  tone?: "urgent" | undefined;
}) {
  const body = (
    <Card className={tone === "urgent" && value > 0 ? "border-danger/50" : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent
        className={`text-2xl font-bold ${tone === "urgent" && value > 0 ? "text-danger" : "text-accent"}`}
      >
        {value}
      </CardContent>
    </Card>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block rounded-xl focus-visible:outline focus-visible:outline-2">
      {body}
    </Link>
  );
}

function Pending({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-lg border p-2 text-sm hover:border-primary ${
        value > 0 ? "border-border" : "border-border/50 text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span className={`font-semibold ${value > 0 ? "text-accent" : "text-muted-foreground"}`}>{value}</span>
    </Link>
  );
}

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded px-2 py-0.5 ${tone}`}>{children}</span>;
}

function Bar({ value, total, className }: { value: number; total: number; className: string }) {
  if (!total || !value) return null;
  return <div className={className} style={{ width: `${(value / total) * 100}%` }} />;
}

function RiskRow({ s }: { s: OverviewStudent }) {
  const top = s.flags[0];
  return (
    <Link
      to="/instructor/students/$studentId"
      params={{ studentId: s.student.id }}
      className="block rounded-lg border border-border p-3 hover:border-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{s.student.full_name || s.student.email}</span>
        <span className="text-xs text-muted-foreground">{s.className}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1">
        {s.flags.map((f) => (
          <li
            key={f.code}
            className={`rounded px-2 py-0.5 text-xs ${
              f.weight >= 70
                ? "bg-danger/15 text-danger"
                : f.weight >= 40
                  ? "bg-warning/15 text-warning"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {f.label}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {s.evaluatedCount} indicador(es) avaliado(s) · {s.deliveries} entrega(s)
        </span>
        <span className={top && top.weight >= 70 ? "text-danger" : "text-accent"}>
          Próxima ação: {s.next.label}
        </span>
      </div>
    </Link>
  );
}
