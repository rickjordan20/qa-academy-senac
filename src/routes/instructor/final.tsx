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
  const situation = ucSituation(inds, evMap, result);
  const [recoveryCell, setRecoveryCell] = useState<IndicatorRow | null>(null);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Avaliação final – Aula 21</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Analise a evolução do aluno, feche cada indicador em A ou NA e, quando houver pendência,
        conduza a Recuperação Final antes de confirmar o resultado.
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
          {/* Parte 1 – Histórico das evidências */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Histórico das evidências</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Menções recebidas nas missões, em ordem. Não há cálculo de média: use o histórico
                para observar a evolução.
              </p>
              {inds.map((i) => {
                const evolution = (origins ?? [])
                  .filter((o) => o.indicator_finals?.[i.code])
                  .map((o) => `${o.missionTitle} → ${o.indicator_finals[i.code]}`);
                return (
                  <div key={i.id} className="rounded-lg border border-border p-3">
                    <span className="mr-2 font-semibold text-primary">{i.code}</span>
                    <span className="text-xs text-muted-foreground">{i.description}</span>
                    <p className="mt-1 text-xs">
                      {evolution.length ? evolution.join(" · ") : "Sem menções registradas em missões."}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Parte 2 – Fechamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Fechamento da Avaliação Final</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Nesta etapa cada indicador recebe apenas A ou NA.
                </p>
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

            {/* Parte 3 – Recuperação Final */}
            {situation.pending.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3. Recuperação Final</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    Somente os indicadores não atendidos. Registre a nova evidência e avalie
                    novamente em A ou NA.
                  </p>
                  {situation.pending.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => setRecoveryCell(i)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-warning/50 p-3 text-left hover:border-primary"
                    >
                      <div>
                        <span className="mr-2 font-semibold text-primary">{i.code}</span>
                        <span className="text-xs text-muted-foreground">{i.description}</span>
                      </div>
                      <span className="text-xs">
                        {evMap.get(i.id)?.stage === "recuperacao"
                          ? "Recuperação avaliada"
                          : "Pendente de recuperação"}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resultado da UC10</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Situação: <span className="font-semibold text-accent">{situation.label}</span>
                </p>
                <p>
                  Sugestão da plataforma:{" "}
                  <span className="font-semibold text-accent">
                    {situation.suggestion ?? "aguardando fechamento/recuperação"}
                  </span>
                </p>
                <p>
                  Resultado confirmado:{" "}
                  <span className="font-semibold">{result?.final_result ?? "não confirmado"}</span>
                </p>
                <div className="flex gap-2">
                  {(["D", "ND"] as const).map((v) => (
                    <Button
                      key={v}
                      variant={result?.final_result === v ? "default" : "outline"}
                      disabled={v === "ND" && situation.pending.length > 0 && !situation.recoveryDone}
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
                      {v === "D" ? "D – Desenvolvido" : "ND – Não Desenvolvido"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  ND só fica disponível após a Recuperação Final. A confirmação é sempre do
                  instrutor.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {recoveryCell && student && active && (
        <IndicatorDialog
          open={!!recoveryCell}
          onOpenChange={(v) => !v && setRecoveryCell(null)}
          classId={active}
          student={student}
          indicator={recoveryCell}
          current={evMap.get(recoveryCell.id)}
          defaultStage="recuperacao"
          concepts={["A", "NA"]}
        />
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
          concepts={["A", "NA"]}
        />
      )}
    </div>
  );
}
