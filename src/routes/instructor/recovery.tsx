import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import {
  pendingIndicators,
  useClassEvaluations,
  useClassStudents,
  useCreateRecoveryPlan,
  useRecoveryPlans,
  useUpdateRecoveryPlan,
  type EvaluationRow,
  type IndicatorRow,
} from "@/lib/assessment";
import { ClassPicker } from "./evaluations";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/instructor/recovery")({
  head: () => ({
    meta: [
      { title: "Recuperação | QA Academy" },
      {
        name: "description",
        content: "Operação Resgate: atividades individuais para os indicadores pendentes da UC10.",
      },
      { property: "og:title", content: "Recuperação | QA Academy" },
      { property: "og:description", content: "Planos de recuperação por indicador pendente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const active = classId ?? classes?.[0]?.id ?? null;
  const { data: indicators } = useIndicators();
  const { data: students } = useClassStudents(active);
  const { data: evaluations } = useClassEvaluations(active);
  const { data: plans } = useRecoveryPlans(active);
  const createPlan = useCreateRecoveryPlan(active);
  const updatePlan = useUpdateRecoveryPlan(active);

  const inds = (indicators ?? []) as IndicatorRow[];
  const codeOf = new Map(inds.map((i) => [i.id, i.code]));
  const evFor = (sid: string) =>
    new Map<string, EvaluationRow>(
      (evaluations ?? []).filter((e) => e.student_id === sid).map((e) => [e.indicator_id, e]),
    );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Recuperação</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Alunos com PA ou NA ficam “Em recuperação”. Crie a Operação Resgate apenas para os
        indicadores pendentes; a avaliação anterior é preservada no histórico.
      </p>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alunos em recuperação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(students ?? []).map((s) => {
              const map = evFor(s.id);
              const pend = pendingIndicators(inds, map);
              if (pend.length === 0) return null;
              const title = `Operação Resgate – ${pend.map((p) => p.code).join(" e ")}`;
              const already = (plans ?? []).some(
                (p) => p.student_id === s.id && p.status !== "closed",
              );
              return (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.full_name || s.email}</span>
                    <span className="rounded-md bg-warning px-2 py-0.5 text-xs text-warning-foreground">
                      Em recuperação
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pend.map((p) => (
                      <span key={p.id} className="flex items-center gap-1 text-xs">
                        <span className="font-semibold text-primary">{p.code}</span>
                        <ConceptBadge concept={map.get(p.id)?.concept ?? null} />
                      </span>
                    ))}
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={already || !user}
                    onClick={async () => {
                      try {
                        await createPlan.mutateAsync({
                          studentId: s.id,
                          title,
                          description: `Atividade individual de recuperação para os indicadores ${pend
                            .map((p) => p.code)
                            .join(", ")}. Envie novas evidências para reavaliação.`,
                          indicatorIds: pend.map((p) => p.id),
                          createdBy: user!.id,
                        });
                        toast.success("Plano de recuperação criado");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {already ? "Plano já aberto" : `Criar ${title}`}
                  </Button>
                </div>
              );
            })}
            {(students ?? []).every((s) => pendingIndicators(inds, evFor(s.id)).length === 0) && (
              <p className="text-sm text-muted-foreground">
                Nenhum aluno com indicador pendente nesta turma.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planos criados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(plans ?? []).map((p) => {
              const student = (students ?? []).find((s) => s.id === p.student_id);
              return (
                <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.status === "closed" ? "Encerrado" : "Em andamento"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {student?.full_name || student?.email} ·{" "}
                    {p.indicator_ids.map((id) => codeOf.get(id) ?? "?").join(", ")}
                  </p>
                  <p className="mt-1 text-xs">{p.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updatePlan.mutate({
                          id: p.id,
                          patch: { status: p.status === "closed" ? "open" : "closed" },
                        })
                      }
                    >
                      {p.status === "closed" ? "Reabrir" : "Encerrar"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {(plans ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum plano de recuperação criado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
