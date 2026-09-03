import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import { useInstructorGroups } from "@/lib/cafe";
import {
  downloadCsv,
  pendingIndicators,
  studentSituation,
  useClassEvaluations,
  useClassStudents,
  useRecoveryPlans,
  useUcResults,
  type EvaluationRow,
  type IndicatorRow,
} from "@/lib/assessment";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/reports/")({
  head: () => ({
    meta: [
      { title: "Relatórios | QA Academy" },
      {
        name: "description",
        content: "Relatórios de aluno, grupo, turma, indicadores e recuperação da UC10.",
      },
      { property: "og:title", content: "Relatórios | QA Academy" },
      { property: "og:description", content: "Exporte em CSV ou imprima em PDF." },
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

  const inds = (indicators ?? []) as IndicatorRow[];
  const evFor = (sid: string) =>
    new Map<string, EvaluationRow>(
      (evaluations ?? []).filter((e) => e.student_id === sid).map((e) => [e.indicator_id, e]),
    );
  const resultMap = new Map((results ?? []).map((r) => [r.student_id, r]));

  const studentRows: (string | number)[][] = [
    ["Aluno", "E-mail", ...inds.map((i) => i.code), "Situação", "Resultado"],
    ...(students ?? []).map((s) => {
      const map = evFor(s.id);
      return [
        s.full_name || s.email,
        s.email,
        ...inds.map((i) => map.get(i.id)?.concept ?? "—"),
        studentSituation(inds, map, resultMap.get(s.id)),
        resultMap.get(s.id)?.final_result ?? "—",
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

  const recoveryRows: (string | number)[][] = [
    ["Aluno", "Indicadores pendentes", "Plano", "Situação do plano"],
    ...(students ?? [])
      .map((s) => {
        const pend = pendingIndicators(inds, evFor(s.id));
        if (pend.length === 0) return null;
        const plan = (plans ?? []).find((p) => p.student_id === s.id);
        return [
          s.full_name || s.email,
          pend.map((p) => p.code).join(", "),
          plan?.title ?? "—",
          plan ? (plan.status === "closed" ? "Encerrado" : "Em andamento") : "não criado",
        ];
      })
      .filter(Boolean) as (string | number)[][],
  ];

  const groupRows: (string | number)[][] = [
    ["Grupo", "Integrantes", "QA Lead"],
    ...(groups ?? []).map((g) => [
      g.name,
      (g.members ?? []).length,
      (g.members ?? []).find((m) => m.student_id === g.qa_lead_id)?.full_name ?? "—",
    ]),
  ];

  const classRow: (string | number)[][] = [
    ["Turma", "Alunos", "Concluíram (D)", "Não desenvolveram (ND)", "Em recuperação"],
    [
      classes?.find((c) => c.id === active)?.name ?? "—",
      (students ?? []).length,
      (results ?? []).filter((r) => r.final_result === "D").length,
      (results ?? []).filter((r) => r.final_result === "ND").length,
      (students ?? []).filter((s) => pendingIndicators(inds, evFor(s.id)).length > 0).length,
    ],
  ];

  const reports = [
    { title: "Relatório de alunos", file: "relatorio-alunos.csv", rows: studentRows },
    { title: "Relatório de indicadores", file: "relatorio-indicadores.csv", rows: indicatorRows },
    { title: "Relatório de recuperação", file: "relatorio-recuperacao.csv", rows: recoveryRows },
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
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          Imprimir / PDF
        </Button>
      </div>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />

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
