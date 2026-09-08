import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import {
  downloadCsv,
  pendingIndicators,
  studentSituation,
  suggestResult,
  useClassEvaluations,
  useClassStudents,
  useConfirmUcResult,
  useUcResults,
  type EvaluationRow,
  type IndicatorRow,
  type StudentInfo,
} from "@/lib/assessment";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { IndicatorDialog } from "@/components/eval/IndicatorDialog";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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

  const { data: indicators } = useIndicators();
  const { data: students } = useClassStudents(active);
  const { data: evaluations } = useClassEvaluations(active);
  const { data: results } = useUcResults(active);
  const confirmResult = useConfirmUcResult(active);

  const [cell, setCell] = useState<{ student: StudentInfo; indicator: IndicatorRow } | null>(null);

  const inds = (indicators ?? []) as IndicatorRow[];
  const evMap = new Map<string, EvaluationRow>(
    (evaluations ?? []).map((e) => [`${e.student_id}:${e.indicator_id}`, e]),
  );
  const resultMap = new Map((results ?? []).map((r) => [r.student_id, r]));
  const forStudent = (sid: string) =>
    new Map(inds.map((i) => [i.id, evMap.get(`${sid}:${i.id}`)!]).filter(([, v]) => !!v) as [string, EvaluationRow][]);

  async function confirm(sid: string, value: "D" | "ND") {
    if (!user) return;
    try {
      await confirmResult.mutateAsync({ studentId: sid, finalResult: value, confirmedBy: user.id });
      toast.success(`Resultado ${value} confirmado`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alunos e indicadores I1 – I6</CardTitle>
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
                          Indicadores NA: {pend.map((p) => p.code).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {result?.final_result ? (
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold">
                          {result.final_result}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            Sugestão: {sit.suggestion ?? "—"}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={sit.suggestion !== "D"}
                              onClick={() => confirm(s.id, "D")}
                            >
                              D
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!sit.recoveryDone}
                              onClick={() => confirm(s.id, "ND")}
                            >
                              ND
                            </Button>
                          </div>
                        </div>
                      )}
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

      {cell && active && (
        <IndicatorDialog
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
