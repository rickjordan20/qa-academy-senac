import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useClassIndicators, useMyClasses } from "@/lib/uc10";
import {
  downloadCsv,
  studentSituation,
  ucSituation,

  useClassEvaluations,
  useClassStudents,
  useUcResults,
  type EvaluationRow,
  type IndicatorRow,
  type StudentInfo,
} from "@/lib/assessment";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { ClosureControls } from "@/components/eval/ClosureControls";
import { IndicatorDialog } from "@/components/eval/IndicatorDialog";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/evaluations")({
  head: () => ({
    meta: [
      { title: "Matriz de avaliação | QA Academy" },
      {
        name: "description",
        content: "Matriz de avaliação da UC10 com conceitos A, PA e NA por indicador e aluno.",
      },
      { property: "og:title", content: "Matriz de avaliação | QA Academy" },
      { property: "og:description", content: "Avalie os indicadores I1–I6 e feche a UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const active = classId ?? classes?.[0]?.id ?? null;

  const { data: indicators, ucCode, ucMissing } = useClassIndicators(active);
  const { data: students } = useClassStudents(active);
  const { data: evaluations } = useClassEvaluations(active);
  const { data: results } = useUcResults(active);

  const [cell, setCell] = useState<{ student: StudentInfo; indicator: IndicatorRow } | null>(null);

  const inds = (indicators ?? []) as IndicatorRow[];
  const evMap = new Map<string, EvaluationRow>(
    (evaluations ?? []).map((e) => [`${e.student_id}:${e.indicator_id}`, e]),
  );
  const resultMap = new Map((results ?? []).map((r) => [r.student_id, r]));
  const forStudent = (sid: string) =>
    new Map(inds.map((i) => [i.id, evMap.get(`${sid}:${i.id}`)!]).filter(([, v]) => !!v) as [string, EvaluationRow][]);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Aluno", ...inds.map((i) => i.code), "Situação", "Resultado"],
      ...(students ?? []).map((s) => {
        const map = forStudent(s.id);
        return [
          s.full_name || s.email,
          ...inds.map((i) => map.get(i.id)?.concept ?? "—"),
          studentSituation(inds, map, resultMap.get(s.id)),
          resultMap.get(s.id)?.final_result ?? "—",
        ];
      }),
    ];
    downloadCsv("matriz-avaliacao.csv", rows);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Matriz de avaliação</h1>
          <p className="text-sm text-muted-foreground">
            Clique em um indicador para ver evidências, feedbacks, histórico e registrar A, PA ou NA.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Exportar CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Imprimir / PDF
          </Button>
        </div>
      </div>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />
      {ucMissing && (
        <p className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Não foi possível identificar a UC desta turma (ou ela não tem indicadores cadastrados). As operações sobre indicadores estão bloqueadas para evitar registros na UC errada.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alunos e indicadores {ucCode ?? ""}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="p-2">Aluno</th>
                {inds.map((i) => (
                  <th key={i.id} className="p-2">
                    {i.code}
                  </th>
                ))}
                <th className="p-2">Situação</th>
                <th className="p-2">Fechamento</th>
              </tr>
            </thead>
            <tbody>
              {(students ?? []).map((s) => {
                const map = forStudent(s.id);
                const result = resultMap.get(s.id);
                const sit = ucSituation(inds, map, result);
                const pend = sit.pending;
                return (
                  <tr key={s.id} className="border-t border-border align-top">
                    <td className="p-2 font-medium">{s.full_name || s.email}</td>
                    {inds.map((i) => (
                      <td key={i.id} className="p-2">
                        <button
                          className="rounded-md transition hover:opacity-80"
                          onClick={() => setCell({ student: s, indicator: i })}
                        >
                          <ConceptBadge concept={map.get(i.id)?.concept ?? null} />
                        </button>
                      </td>
                    ))}
                    <td className="p-2 text-xs">
                      {sit.label}
                      {pend.length > 0 && (
                        <span className="block text-muted-foreground">
                          Indicadores pendentes (PA/NA): {pend.map((p) => `${p.code} (${map.get(p.id)?.concept})`).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {!result?.final_result && (
                        <span className="mb-1 block text-xs text-muted-foreground">
                          Sugestão: {sit.suggestion ?? "—"}
                        </span>
                      )}
                      <ClosureControls
                        compact
                        classId={active}
                        studentId={s.id}
                        indicators={inds}
                        byIndicator={map}
                        result={result}
                      />
                    </td>
                  </tr>
                );
              })}

              {(students ?? []).length === 0 && (
                <tr>
                  <td className="p-2 text-muted-foreground" colSpan={inds.length + 3}>
                    Nenhum aluno matriculado nesta turma.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {cell && active && !ucMissing && (
        <IndicatorDialog
          ucResult={resultMap.get(cell.student.id)}
          open={!!cell}
          onOpenChange={(v) => !v && setCell(null)}
          classId={active}
          student={cell.student}
          indicator={cell.indicator}
          current={evMap.get(`${cell.student.id}:${cell.indicator.id}`)}
        />
      )}
    </div>
  );
}
