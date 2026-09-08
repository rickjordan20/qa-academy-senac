import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import { useInstructorGroups } from "@/lib/cafe";
import {
  downloadCsv,
  nextAction,
  ucSituation,

  useClassEvaluations,
  useClassStudents,
  useRecoveryPlans,
  useUcResults,
  type EvaluationRow,
  type IndicatorRow,
} from "@/lib/assessment";
import { useClosureReport } from "@/lib/closure-report";
import { EVAL_LABEL, fmtDateTime, useAllSubmissions, useReevaluatedRuns } from "@/lib/mission-submissions";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/reports/")({
  head: () => ({
    meta: [
      { title: "Relatórios | QA Academy" },
      {
        name: "description",
        content: "Relatórios de aluno, grupo, turma, indicadores, reavaliações, XP e recuperação da UC10.",
      },
      { property: "og:title", content: "Relatórios | QA Academy" },
      { property: "og:description", content: "Exporte em CSV ou gere PDFs de entregas e fechamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const active = classId ?? classes?.[0]?.id ?? null;
  const { data: students } = useClassStudents(active);
  const { data: indicators } = useIndicators();
  const { data: evaluations } = useClassEvaluations(active);
  const { data: results } = useUcResults(active);
  const { data: plans } = useRecoveryPlans(active);
  const { data: groups } = useInstructorGroups(user?.id ?? null);
  const { data: closure } = useClosureReport(active);
  const { data: submissions } = useAllSubmissions();
  const { data: reevaluated } = useReevaluatedRuns();

  const inds = (indicators ?? []) as IndicatorRow[];
  const evFor = (sid: string) =>
    new Map<string, EvaluationRow>(
      (evaluations ?? []).filter((e) => e.student_id === sid).map((e) => [e.indicator_id, e]),
    );
  const resultMap = new Map((results ?? []).map((r) => [r.student_id, r]));
  const situationFor = (sid: string) => ucSituation(inds, evFor(sid), resultMap.get(sid));
  const classSubmissions = (submissions ?? []).filter((r) => !active || r.classId === active);
  const workFor = (sid: string) => {
    const runs = classSubmissions.filter((r) => r.student_id === sid);
    const awaiting = runs.filter(
      (r) => r.eval_status === "awaiting" || (!!r.submitted_at && r.eval_status === "none"),
    );
    const reevalRuns = runs.filter((r) => r.eval_status === "reeval");
    return {
      awaiting: awaiting.length,
      reeval: reevalRuns.length,
      awaitingTitle: awaiting.length === 1 ? awaiting[0]?.mission?.title ?? null : null,
      reevalTitle: reevalRuns.length === 1 ? reevalRuns[0]?.mission?.title ?? null : null,
    };
  };
  const nextActionFor = (sid: string) => nextAction(situationFor(sid), workFor(sid));

  const studentRows: (string | number)[][] = [
    ["Aluno", "E-mail", ...inds.map((i) => i.code), "Situação", "Resultado", "Próxima ação"],
    ...(students ?? []).map((s) => {
      const map = evFor(s.id);
      return [
        s.full_name || s.email,
        s.email,
        /* Ausência de avaliação nunca vira NA. */
        ...inds.map((i) => map.get(i.id)?.concept ?? "Não avaliado"),
        situationFor(s.id).label,
        resultMap.get(s.id)?.final_result ?? "Não confirmado",
        nextActionFor(s.id).label,
      ];
    }),
  ];


  const indicatorRows: (string | number)[][] = [
    ["Indicador", "Descrição", "A", "PA", "NA", "Não avaliado"],
    ...inds.map((i) => {
      const all = (evaluations ?? []).filter((e) => e.indicator_id === i.id);
      const c = (v: string) => all.filter((e) => e.concept === v).length;
      return [
        i.code,
        i.description,
        c("A"),
        c("PA"),
        c("NA"),
        (students ?? []).length - all.filter((e) => e.concept).length,
      ];
    }),
  ];

  /* Recuperação Final: somente indicadores fechados em NA. */
  const recoveryRows: (string | number)[][] = [
    ["Aluno", "Situação", "Indicadores NA", "Plano", "Situação do plano"],
    ...(students ?? [])
      .map((s) => {
        const sit = situationFor(s.id);
        if (!["needs_recovery", "in_recovery", "ready_nd", "ND"].includes(sit.key)) return null;
        const plan = (plans ?? []).find((p) => p.student_id === s.id);
        return [
          s.full_name || s.email,
          sit.label,
          sit.pending.map((p) => p.code).join(", ") || "—",
          plan?.title ?? "—",
          plan ? (plan.status === "closed" ? "Encerrado" : "Em andamento") : "não criado",
        ];
      })
      .filter(Boolean) as (string | number)[][],
  ];

  /* Reavaliações de missões (somente leitura). */

  const reevalRows: (string | number)[][] = [
    ["Aluno / Grupo", "Missão", "Situação", "Tentativa", "Reavaliada", "Última atualização"],
    ...classSubmissions
      .filter((r) => r.eval_status === "reeval" || reevaluated?.has(r.id) || (r.attempt ?? 1) > 1)
      .map((r) => [
        r.groupName ?? r.studentName,
        r.mission?.title ?? "—",
        EVAL_LABEL[r.eval_status] ?? r.eval_status,
        r.attempt ?? 1,
        reevaluated?.has(r.id) ? "Sim" : "Não",
        fmtDateTime(r.updated_at),
      ]),
  ];

  /* XP e badges — informativo, não influencia A/PA/NA nem D/ND. */
  const xpRows: (string | number)[][] = [
    ["Aluno", "XP aprovado", "XP pendente", "Badges", "Lista de badges"],
    ...(closure?.students ?? []).map((s) => [
      s.name,
      s.xpTotal,
      s.xpPending,
      s.badges.length,
      s.badges.map((b) => b.name).join(", ") || "—",
    ]),
  ];

  const groupRows: (string | number)[][] = [
    ["Grupo", "Integrantes", "QA Lead"],
    ...(groups ?? []).map((g) => [
      g.name,
      (g.members ?? []).length,
      (g.members ?? []).find((m) => m.student_id === g.qa_lead_id)?.full_name ?? "—",
    ]),
  ];

  const s = closure?.summary;
  const classRow: (string | number)[][] = [
    ["Turma", "Alunos", "Em andamento", "Necessitam Recuperação", "Em Recuperação", "D", "ND"],
    [
      classes?.find((c) => c.id === active)?.name ?? "—",
      s?.total ?? (students ?? []).length,
      (s?.inProgress ?? 0) + (s?.finalOpen ?? 0),
      s?.needsRecovery ?? 0,
      s?.inRecovery ?? 0,
      s?.d ?? 0,
      s?.nd ?? 0,
    ],
  ];

  const reports = [
    { title: "Relatório de alunos", file: "relatorio-alunos.csv", rows: studentRows },
    { title: "Relatório de indicadores", file: "relatorio-indicadores.csv", rows: indicatorRows },
    { title: "Relatório de Recuperação Final", file: "relatorio-recuperacao.csv", rows: recoveryRows },
    { title: "Relatório de reavaliações de missões", file: "relatorio-reavaliacoes.csv", rows: reevalRows },
    { title: "Relatório de XP e badges (informativo)", file: "relatorio-xp-badges.csv", rows: xpRows },
    { title: "Relatório de grupos", file: "relatorio-grupos.csv", rows: groupRows },
    { title: "Relatório da turma", file: "relatorio-turma.csv", rows: classRow },
  ];


  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Informações objetivas para acompanhamento e fechamento da UC10.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/instructor/reports/deliveries">Entregas por Missão</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/instructor/reports/closure">Fechamento da UC10</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Imprimir / PDF
          </Button>
        </div>

      </div>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />

      {/* Painel de acompanhamento: resumo → situação → próxima ação → detalhes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Acompanhamento da turma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "Em avaliação", n: (s?.inProgress ?? 0) },
              { label: "Avaliação Final", n: (s?.finalOpen ?? 0) },
              { label: "Necessita Recuperação Final", n: s?.needsRecovery ?? 0 },
              { label: "Em Recuperação Final", n: s?.inRecovery ?? 0 },
              { label: "D — Desenvolvido", n: s?.d ?? 0 },
              { label: "ND — Não Desenvolvido", n: s?.nd ?? 0 },
            ].map((c) => (
              <span key={c.label} className="rounded-md border border-border px-2 py-1">
                {c.label}: <strong>{c.n}</strong>
              </span>
            ))}
          </div>

          {(students ?? []).map((st) => {
            const sit = situationFor(st.id);
            const na = nextActionFor(st.id);
            const map = evFor(st.id);

            return (
              <details key={st.id} className="rounded-lg border border-border p-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{st.full_name || st.email}</span>
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs">{sit.label}</span>
                </summary>

                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Próxima ação: </span>
                  <strong>{na.label}</strong>
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {na.to && (
                    <Button asChild size="sm">
                      <Link to={na.to}>Ir para a ação</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to="/instructor/submissions">Ver entregas</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/instructor/dossier">Ver dossiê</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/instructor/portfolios">Ver portfólio</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/instructor/evaluations">Matriz I1–I6</Link>
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {inds.map((i) => (
                    <span key={i.id} className="flex items-center gap-1 text-xs">
                      <span className="font-semibold text-primary">{i.code}</span>
                      <ConceptBadge concept={map.get(i.id)?.concept ?? null} />
                    </span>
                  ))}
                </div>
              </details>
            );
          })}
          {(students ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum aluno matriculado nesta turma.</p>
          )}
        </CardContent>
      </Card>


      <div className="space-y-6">
        {reports.map((r) => {
          const header = r.rows[0] ?? [];
          return (
            <Card key={r.file}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{r.title}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(r.file, r.rows)}>
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    {header.map((h, i) => (
                      <th key={i} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rows.slice(1).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => (
                        <td key={j} className="p-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {r.rows.length === 1 && (
                    <tr>
                      <td className="p-2 text-muted-foreground" colSpan={header.length}>
                        Sem dados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
