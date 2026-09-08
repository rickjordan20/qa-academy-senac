import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import {
  nextAction,
  ucSituation,
  stageLabel,
  useClassEvaluations,
  useClassStudents,
  useEvalHistory,
  useFeedbacks,
  useStudentDossier,
  useUcResults,
  type EvaluationRow,
  type IndicatorRow,
} from "@/lib/assessment";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/dossier")({
  head: () => ({
    meta: [
      { title: "Dossiê individual | QA Academy" },
      {
        name: "description",
        content: "Dossiê do aluno organizado por indicador da UC10, com evidências e feedbacks.",
      },
      { property: "og:title", content: "Dossiê individual | QA Academy" },
      { property: "og:description", content: "Registros de TechEduca e Café Central por indicador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DossierPage,
});

function DossierPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const active = classId ?? classes?.[0]?.id ?? null;
  const { data: students } = useClassStudents(active);
  const [studentId, setStudentId] = useState<string | null>(null);
  const student = (students ?? []).find((s) => s.id === studentId) ?? students?.[0] ?? null;

  const { data: indicators } = useIndicators();
  const { data: evaluations } = useClassEvaluations(active);
  const { data: dossier } = useStudentDossier(student?.id ?? null);
  const { data: history } = useEvalHistory(student?.id ?? null);
  const { data: feedbacks } = useFeedbacks(student?.id ?? null);
  const { data: results } = useUcResults(active);

  const inds = (indicators ?? []) as IndicatorRow[];
  const evMap = new Map<string, EvaluationRow>(
    (evaluations ?? []).filter((e) => e.student_id === student?.id).map((e) => [e.indicator_id, e]),
  );
  const result = (results ?? []).find((r) => r.student_id === student?.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dossiê individual</h1>
          <p className="text-sm text-muted-foreground">
            Todos os registros do aluno organizados por indicador.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          Imprimir / PDF
        </Button>
      </div>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />

      <div className="mb-4 flex flex-wrap gap-2">
        {(students ?? []).map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={student?.id === s.id ? "default" : "outline"}
            onClick={() => setStudentId(s.id)}
          >
            {s.full_name || s.email}
          </Button>
        ))}
      </div>

      {student && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{student.full_name || student.email}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                Situação:{" "}
                <span className="font-semibold text-accent">
                  {ucSituation(inds, evMap, result).label}
                </span>
              </p>
              <p>
                Resultado confirmado:{" "}
                <span className="font-semibold">{result?.final_result ?? "não confirmado"}</span>
              </p>
              <p>
                Próxima ação:{" "}
                <span className="font-semibold">
                  {nextAction(ucSituation(inds, evMap, result)).label}
                </span>
              </p>
            </CardContent>

          </Card>

          {inds.map((ind) => {
            const ev = evMap.get(ind.id);
            const indHistory = (history ?? []).filter((h) => h.indicator_id === ind.id);
            const indFeedbacks = (feedbacks ?? []).filter((f) => f.indicator_id === ind.id);
            return (
              <Card key={ind.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>
                      <span className="mr-2 text-primary">{ind.code}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {ind.description}
                      </span>
                    </span>
                    <ConceptBadge concept={ev?.concept ?? null} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-accent">TechEduca</h3>
                    <List
                      items={[
                        ...(dossier?.cases ?? [])
                          .filter((c) => c.context === "techeduca")
                          .map((c) => `Caso: ${c.title} (${c.status})`),
                        ...(dossier?.runs ?? []).map((r) => {
                          const m = (dossier?.missions ?? []).find((x) => x.id === r.mission_id);
                          return `Execução: ${m?.title ?? r.mission_id} (${r.status})`;
                        }),
                        ...(dossier?.teEvidences ?? []).map((e) => `Evidência: ${e.title}`),
                        ...(dossier?.qaEvidences ?? [])
                          .filter((e) => e.context === "techeduca")
                          .map((e) => `Evidência: ${e.title} (${e.kind})`),
                      ]}
                    />
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-accent">Café Central</h3>
                    <List
                      items={[
                        ...(dossier?.tasks ?? []).map((t) => `Tarefa: ${t.title} (${t.status})`),
                        ...(dossier?.cases ?? [])
                          .filter((c) => c.context === "cafe")
                          .map((c) => `Caso: ${c.title} (${c.status})`),
                        ...(dossier?.bugs ?? [])
                          .filter((b) => b.context === "cafe")
                          .map((b) => `Bug: ${b.title} (${b.status})`),
                        ...(dossier?.retests ?? []).map((r) => `Reteste: ${r.result}`),
                      ]}
                    />
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-accent">Feedbacks</h3>
                    <List items={indFeedbacks.map((f) => f.message)} />
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-accent">Histórico</h3>
                    <List
                      items={indHistory.map(
                        (h) =>
                          `${h.concept ?? "—"} · ${stageLabel(h.stage)} · ${new Date(
                            h.created_at,
                          ).toLocaleDateString("pt-BR")}`,
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">Nenhum registro.</p>;
  return (
    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
