import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMyGroups } from "@/lib/cafe";
import { XpOverview } from "@/components/gam/XpOverview";
import { useIndicators, useMyEnrollment, useMyEvaluations } from "@/lib/uc10";
import { useMyEvaluationAck } from "@/lib/assessment";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({
    meta: [
      { title: "Início do aluno | QA Academy" },
      { name: "description", content: "Sua turma, seu progresso e os indicadores I1–I6 da UC10." },
      { property: "og:title", content: "Início do aluno | QA Academy" },
      { property: "og:description", content: "Acompanhe sua jornada na UC10 de testes de software." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user, profile } = useAuth();
  const { data: enrollment } = useMyEnrollment(user?.id ?? null);
  const { data: evaluations } = useMyEvaluations(user?.id ?? null);
  const { data: indicators } = useIndicators();
  const { data: groups } = useMyGroups(user?.id ?? null);
  const { data: evalAck } = useMyEvaluationAck(user?.id ?? null);

  const byIndicator = new Map((evaluations ?? []).map((e) => [e.indicator_id, e]));
  const total = indicators?.length ?? 0;
  const met = (evaluations ?? []).filter((e) => e.concept === "A").length;
  const progress = total ? Math.round((met / total) * 100) : 0;

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Área do aluno
        </span>
        <h1 className="mt-1 text-2xl font-bold">
          UC10 – Realizar testes nas aplicações desenvolvidas
        </h1>
      </div>

      {!evalAck ? (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border-2 border-accent/60 bg-accent/10 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
            <div>
              <p className="font-semibold">Entenda como você será avaliado</p>
              <p className="text-sm text-muted-foreground">
                Antes de começar, veja como funcionam as missões, as notas A/PA/NA, os
                indicadores I1–I6 e o XP — e registre sua ciência.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/student/how-evaluated">Ver como serei avaliado</Link>
          </Button>
        </div>
      ) : (
        <p className="mb-6 text-sm">
          <Link to="/student/how-evaluated" className="text-accent hover:underline">
            Como você será avaliado
          </Link>
          <span className="text-muted-foreground"> — ciência registrada. Revise quando quiser.</span>
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aluno</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {profile?.full_name || profile?.email}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Turma</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {enrollment?.classes?.name ?? "Sem turma"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Progresso da UC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-lg font-semibold">{progress}%</div>
            <Progress value={progress} />
            <p className="mt-2 text-xs text-muted-foreground">
              {met} de {total} indicadores atendidos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <XpOverview
          userId={user?.id ?? null}
          groupIds={(groups ?? []).map((g) => g.id)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Indicadores I1 – I6</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(indicators ?? []).map((ind) => {
            const ev = byIndicator.get(ind.id);
            return (
              <div
                key={ind.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <span className="mr-2 font-semibold text-primary">{ind.code}</span>
                  <span className="text-sm text-muted-foreground">{ind.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ConceptBadge concept={ev?.concept as Concept} />
                  {ev?.final_result && (
                    <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                      {ev.final_result}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
