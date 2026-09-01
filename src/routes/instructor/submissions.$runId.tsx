import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useIndicators } from "@/lib/uc10";
import { SubmissionDetail } from "@/routes/student/missions.$runId";
import { useEvaluateSubmission, useIndicatorResults, useSubmission } from "@/lib/mission-submissions";

export const Route = createFileRoute("/instructor/submissions/$runId")({
  head: () => ({
    meta: [
      { title: "Ficha de avaliação | QA Academy" },
      { name: "description", content: "Avalie o envio da missão: respostas, evidências, XP manual e indicadores I1-I6." },
      { property: "og:title", content: "Ficha de avaliação | QA Academy" },
      { property: "og:description", content: "Avaliação detalhada de um envio de missão da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluatePage,
});

const CONCEPTS = ["A", "PA", "NA"] as const;

function EvaluatePage() {
  const { runId } = Route.useParams();
  const { user } = useAuth();
  const { data } = useSubmission(runId);
  const { data: indicators } = useIndicators();
  const run = data?.run ?? null;
  const { data: current } = useIndicatorResults(run?.classId ?? null, run?.student_id ?? null);
  const evaluate = useEvaluateSubmission();

  const [xp, setXp] = useState("");
  const [feedback, setFeedback] = useState("");
  const [concepts, setConcepts] = useState<Record<string, string>>({});
  const hydrated = useState<{ id: string | null }>({ id: null })[0];

  useEffect(() => {
    if (run && hydrated.id !== run.id) {
      hydrated.id = run.id;
      setXp(String(run.xp_awarded ?? run.mission?.base_xp ?? 0));
      setFeedback(run.feedback ?? "");
    }
  }, [run, hydrated]);

  useEffect(() => {
    if (current) setConcepts((c) => ({ ...current, ...c }));
  }, [current]);

  const missionIndicators = (indicators ?? []).filter(
    (i) => !run?.mission?.indicator_codes?.length || run.mission.indicator_codes.includes(i.code),
  );

  async function submit(decision: "draft" | "evaluated" | "revision") {
    if (!run || !user) return;
    await evaluate.mutateAsync({
      run,
      instructorId: user.id,
      decision,
      xp: Number(xp) || 0,
      feedback,
      indicators: concepts,
    });
    toast.success(
      decision === "evaluated"
        ? "Avaliação registrada. XP e indicadores atualizados."
        : decision === "revision"
          ? "Revisão solicitada ao aluno."
          : "Rascunho da avaliação salvo.",
    );
  }

  return (
    <div className="space-y-5">
      <SubmissionDetail
        runId={runId}
        backTo={
          <Link to="/instructor/submissions" className="text-xs text-muted-foreground hover:underline">
            ← Central de avaliação
          </Link>
        }
      />

      {run ? (
        <Card className="max-w-4xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ficha de avaliação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs">
              <label className="text-xs font-semibold text-muted-foreground">XP a conceder</label>
              <Input type="number" min={0} value={xp} onChange={(e) => setXp(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                XP base da missão: {run.mission?.base_xp ?? 0}. O XP não define A/PA/NA.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Feedback para o aluno</label>
              <Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground">Indicadores UC10</p>
              {run.student_id ? (
                <div className="mt-2 space-y-2">
                  {missionIndicators.map((i) => (
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                      <span className="text-sm">
                        <span className="font-semibold">{i.code}</span> — {i.description}
                      </span>
                      <div className="flex gap-1">
                        {CONCEPTS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setConcepts((prev) => ({ ...prev, [i.id]: prev[i.id] === c ? "" : c }))}
                            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                              concepts[i.id] === c ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Envio de grupo: registre as menções individuais na Matriz de Avaliação.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={evaluate.isPending} onClick={() => submit("evaluated")}>
                Concluir avaliação
              </Button>
              <Button variant="outline" disabled={evaluate.isPending} onClick={() => submit("draft")}>
                Salvar rascunho
              </Button>
              <Button variant="outline" disabled={evaluate.isPending} onClick={() => submit("revision")}>
                Solicitar revisão
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
