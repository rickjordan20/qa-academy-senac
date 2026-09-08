import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import {
  pendingIndicators,
  suggestResult,
  useClassEvaluations,
  useClassStudents,
  useConfirmUcResult,
  useUcResults,
  type EvaluationRow,
  type IndicatorRow,
  type StudentInfo,
} from "@/lib/assessment";
import { useIndicatorOrigins } from "@/lib/mission-submissions";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { IndicatorDialog } from "@/components/eval/IndicatorDialog";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/instructor/final")({
  head: () => ({
    meta: [
      { title: "Avaliação final (Aula 21) | QA Academy" },
      {
        name: "description",
        content: "Módulo da Aula 21 para avaliação final individual dos indicadores I1–I6.",
      },
      { property: "og:title", content: "Avaliação final (Aula 21) | QA Academy" },
      { property: "og:description", content: "Feche a UC10 com avaliação final por indicador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinalPage,
});

function FinalPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const active = classId ?? classes?.[0]?.id ?? null;
  const { data: indicators } = useIndicators();
  const { data: students } = useClassStudents(active);
  const { data: evaluations } = useClassEvaluations(active);
  const { data: results } = useUcResults(active);
  const confirmResult = useConfirmUcResult(active);
  const [selected, setSelected] = useState<StudentInfo | null>(null);
  const [cell, setCell] = useState<IndicatorRow | null>(null);

  const inds = (indicators ?? []) as IndicatorRow[];
  const student = selected ?? students?.[0] ?? null;
  const evMap = new Map<string, EvaluationRow>(
    (evaluations ?? [])
      .filter((e) => e.student_id === student?.id)
      .map((e) => [e.indicator_id, e]),
  );
  const { data: origins } = useIndicatorOrigins(student?.id ?? null);
  const result = (results ?? []).find((r) => r.student_id === student?.id);

  // No fechamento da UC cada indicador vale apenas A ou NA.
  const finalConcepts = inds.map((i) => evMap.get(i.id)?.concept ?? null);
  const closed = inds.length > 0 && finalConcepts.every((c) => c === "A" || c === "NA");
  const suggestion = closed
    ? finalConcepts.every((c) => c === "A")
      ? ("D" as const)
      : ("ND" as const)
    : suggestResult([], inds.length);
  const pend = pendingIndicators(inds, evMap);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Avaliação final – Aula 21</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Avaliação individual: registre A, PA ou NA em cada indicador e confirme o resultado da UC.
      </p>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />

      <div className="mb-4 flex flex-wrap gap-2">
        {(students ?? []).map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={student?.id === s.id ? "default" : "outline"}
            onClick={() => setSelected(s)}
          >
            {s.full_name || s.email}
          </Button>
        ))}
      </div>

      {student && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indicadores I1 – I6</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inds.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setCell(i)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:border-primary"
                >
                  <div>
                    <span className="mr-2 font-semibold text-primary">{i.code}</span>
                    <span className="text-sm text-muted-foreground">{i.description}</span>
                  </div>
                  <ConceptBadge concept={evMap.get(i.id)?.concept ?? null} />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado da UC10</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Sugestão da plataforma:{" "}
                <span className="font-semibold text-accent">{suggestion ?? "avaliação incompleta"}</span>
              </p>
              {pend.length > 0 && (
                <p className="text-muted-foreground">
                  Indicadores pendentes: {pend.map((p) => p.code).join(", ")} — recomendável abrir
                  recuperação antes de fechar.
                </p>
              )}
              <p>
                Resultado confirmado:{" "}
                <span className="font-semibold">{result?.final_result ?? "não confirmado"}</span>
              </p>
              <div className="flex gap-2">
                {(["D", "ND"] as const).map((v) => (
                  <Button
                    key={v}
                    variant={result?.final_result === v ? "default" : "outline"}
                    onClick={async () => {
                      if (!user) return;
                      try {
                        await confirmResult.mutateAsync({
                          studentId: student.id,
                          finalResult: v,
                          confirmedBy: user.id,
                        });
                        toast.success(`Resultado ${v} confirmado`);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {v === "D" ? "D – Desenvolveu" : "ND – Não desenvolveu"}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                A plataforma apenas sugere; a confirmação é sempre do instrutor.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {cell && student && active && (
        <IndicatorDialog
          open={!!cell}
          onOpenChange={(v) => !v && setCell(null)}
          classId={active}
          student={student}
          indicator={cell}
          current={evMap.get(cell.id)}
          defaultStage="final"
        />
      )}
    </div>
  );
}
