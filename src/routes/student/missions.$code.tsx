import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  openEvidenceFile,
  useEnsureRun,
  useMission,
  useMyBugReports,
  useMyEvidences,
  useUpdateRun,
} from "@/lib/techeduca";
import { BugReportForm } from "@/components/techeduca/BugReportForm";
import { EvidenceForm } from "@/components/techeduca/EvidenceForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/student/missions/$code")({
  head: () => ({
    meta: [
      { title: "Missão guiada | QA Academy" },
      {
        name: "description",
        content: "Missão guiada individual da trilha TechEduca: conteúdo, prática e checkpoint.",
      },
      { property: "og:title", content: "Missão guiada | QA Academy" },
      {
        property: "og:description",
        content: "Execute sua missão individual, registre bugs e produza evidências.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  const { code } = Route.useParams();
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const { data: mission, isPending } = useMission(code);
  const { data: run } = useEnsureRun(userId, mission?.id ?? null);
  const update = useUpdateRun(userId);
  const { data: allBugs } = useMyBugReports(userId);
  const { data: allEvidences } = useMyEvidences(userId);

  const bugs = (allBugs ?? []).filter((b) => b.run_id === run?.id);
  const evidences = (allEvidences ?? []).filter((e) => e.run_id === run?.id);

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reflection, setReflection] = useState("");

  useEffect(() => {
    if (!run) return;
    setChecklist(run.checklist_state ?? {});
    setAnswers(run.checkpoint_answers ?? {});
    setReflection(run.reflection ?? "");
  }, [run?.id]);

  if (isPending) return <p className="text-sm text-muted-foreground">Carregando missão...</p>;
  if (!mission) return <p className="text-sm text-muted-foreground">Missão não encontrada.</p>;

  const doneCount = mission.checklist.filter((c) => checklist[c.id]).length;
  const pct = mission.checklist.length
    ? Math.round((doneCount / mission.checklist.length) * 100)
    : 0;

  function toggle(id: string, value: boolean) {
    const next = { ...checklist, [id]: value };
    setChecklist(next);
    if (run) update.mutate({ runId: run.id, patch: { checklist_state: next } });
  }

  async function saveCheckpoint() {
    if (!run) return;
    await update.mutateAsync({
      runId: run.id,
      patch: { checkpoint_answers: answers, reflection },
    });
    toast.success("Respostas e reflexão salvas.");
  }

  async function complete() {
    if (!run) return;
    await update.mutateAsync({
      runId: run.id,
      patch: {
        checklist_state: checklist,
        checkpoint_answers: answers,
        reflection,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    });
    toast.success("Missão concluída e registrada no seu histórico.");
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          TechEduca · Missão guiada individual
        </span>
        <h1 className="mt-1 text-2xl font-bold">{mission.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mission.objective}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Autor da execução: {profile?.full_name || profile?.email}</span>
          <span>·</span>
          <span>
            {run?.status === "completed" ? "Concluída" : "Em andamento"}
          </span>
          {mission.indicator_codes.map((c) => (
            <span key={c} className="rounded-md bg-secondary px-2 py-0.5 font-semibold text-primary">
              {c}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <Progress value={pct} />
          <p className="mt-1 text-xs text-muted-foreground">Progresso do checklist: {pct}%</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo resumido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {mission.summary.map((s) => (
            <div key={s.topic} className="rounded-lg border border-border p-3">
              <div className="text-sm font-semibold text-primary">{s.topic}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mission.checklist.map((c) => (
            <label key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={!!checklist[c.id]}
                onCheckedChange={(v) => toggle(c.id, v === true)}
              />
              <span className="text-sm">{c.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prática: {mission.practice.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{mission.practice.instructions}</p>
          {mission.practice.tips && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {mission.practice.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">Novo registro de bug</h3>
            <BugReportForm userId={userId} runId={run?.id ?? null} missionId={mission.id} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Meus registros nesta missão ({bugs.length})</h3>
            <div className="space-y-2">
              {bugs.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
              )}
              {bugs.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{b.feature}</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                      {b.classification}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{b.problem}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidências desta missão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceForm userId={userId} runId={run?.id ?? null} bugs={bugs} />
          <div className="space-y-2">
            {evidences.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma evidência ainda.</p>
            )}
            {evidences.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <div>
                  <div className="font-semibold">{ev.title}</div>
                  {ev.description && <p className="text-muted-foreground">{ev.description}</p>}
                </div>
                <div className="flex gap-2">
                  {ev.link && (
                    <a
                      href={ev.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent underline"
                    >
                      Abrir link
                    </a>
                  )}
                  {ev.file_path && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void openEvidenceFile(ev.file_path!)}
                    >
                      Ver arquivo
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mission.checkpoint.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <Label htmlFor={q.id}>{q.question}</Label>
              <Textarea
                id={q.id}
                rows={2}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="reflection">Reflexão final</Label>
            <Textarea
              id="reflection"
              rows={3}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="O que você aprendeu nesta missão?"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void saveCheckpoint()}>
              Salvar respostas
            </Button>
            <Button onClick={() => void complete()} disabled={run?.status === "completed"}>
              {run?.status === "completed" ? "Missão concluída" : "Concluir missão"}
            </Button>
            <Button asChild variant="ghost">
              <Link to="/student/missions">Voltar</Link>
            </Button>
          </div>
          {run?.status === "completed" && (
            <p className="text-sm text-muted-foreground">
              Concluída em {new Date(run.completed_at ?? run.started_at).toLocaleString("pt-BR")} ·{" "}
              {evidences.length} evidência(s) produzida(s) · {bugs.length} registro(s) · checklist {pct}%.
              Nenhum conceito é atribuído automaticamente: a avaliação continua com o instrutor.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
