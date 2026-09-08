import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAdminClasses, useAdminGroups, useRoster, ENROLLMENT_STATUS, labelOf } from "@/lib/admin";
import { useStudentDossier, useEvalHistory, useStudentEvaluationAck } from "@/lib/assessment";
import { useIndicators } from "@/lib/uc10";
import { AuditList } from "@/components/admin/AuditList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/instructor/students/$studentId")({
  head: () => ({
    meta: [
      { title: "Visão 360° do aluno | QA Academy" },
      {
        name: "description",
        content: "Jornada, evidências, casos, bugs, XP, indicadores e avaliação de um aluno da UC10.",
      },
      { property: "og:title", content: "Visão 360° do aluno | QA Academy" },
      { property: "og:description", content: "Todo o percurso do aluno na UC10 em uma única tela." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Student360,
});

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Student360() {
  const { studentId } = Route.useParams();
  const { user } = useAuth();
  const { data: classes } = useAdminClasses(user?.id ?? null);
  const classIds = useMemo(() => (classes ?? []).map((c) => c.id), [classes]);
  const { data: roster } = useRoster(classIds);
  const { data: groups } = useAdminGroups(classIds);
  const { data: dossier } = useStudentDossier(studentId);
  const { data: history } = useEvalHistory(studentId);
  const { data: indicators } = useIndicators();

  const enrollment = (roster ?? []).find((r) => r.student_id === studentId) ?? null;
  const group =
    (groups ?? []).find(
      (g) => g.qa_lead_id === studentId || (g.group_members ?? []).some((m) => m.student_id === studentId),
    ) ?? null;

  const { data: evaluations } = useQuery({
    queryKey: ["student-evals", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("indicator_id, concept, notes, evaluated_at")
        .eq("student_id", studentId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: xp } = useQuery({
    queryKey: ["student-xp", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gam_xp_events")
        .select("xp, status")
        .eq("student_id", studentId);
      if (error) throw error;
      const approved = (data ?? []).filter((e) => e.status === "approved").reduce((s, e) => s + e.xp, 0);
      const pending = (data ?? []).filter((e) => e.status === "pending").reduce((s, e) => s + e.xp, 0);
      const { data: badges } = await supabase
        .from("gam_student_badges")
        .select("badge_code")
        .eq("student_id", studentId);
      return { approved, pending, badges: (badges ?? []).map((b) => b.badge_code) };
    },
  });

  const conceptByIndicator = new Map((evaluations ?? []).map((e) => [e.indicator_id, e.concept]));

  return (
    <div className="space-y-6">
      <Link to="/instructor/students" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar para alunos
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {enrollment?.profile?.full_name || enrollment?.profile?.email || "Aluno"}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">
            {(classes ?? []).find((c) => c.id === enrollment?.class_id)?.name ?? "Sem turma"}
          </Badge>
          <Badge variant="secondary">{group ? group.name : "Sem grupo"}</Badge>
          {group?.qa_lead_id === studentId ? <Badge>QA Lead</Badge> : null}
          <Badge>{labelOf(ENROLLMENT_STATUS, enrollment?.status ?? "active")}</Badge>
          {enrollment?.student_code ? <Badge variant="outline">Matrícula {enrollment.student_code}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Missões TechEduca" value={(dossier?.runs ?? []).length} />
        <Stat label="Casos de teste" value={(dossier?.cases ?? []).length} />
        <Stat label="Bugs" value={(dossier?.bugs ?? []).length + (dossier?.teBugs ?? []).length} />
        <Stat label="Retestes" value={(dossier?.retests ?? []).length} />
        <Stat
          label="Evidências"
          value={(dossier?.qaEvidences ?? []).length + (dossier?.teEvidences ?? []).length}
        />
        <Stat label="XP aprovado" value={xp?.approved ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Indicadores I1–I6</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(indicators ?? []).map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span>
                  <span className="font-medium">{i.code}</span>{" "}
                  <span className="text-xs text-muted-foreground">{i.description}</span>
                </span>
                <Badge variant={conceptByIndicator.get(i.id) ? "default" : "outline"}>
                  {conceptByIndicator.get(i.id) ?? "—"}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Progresso e XP não definem conceito. Somente o instrutor avalia em Matriz de Avaliação.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gamificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>XP aprovado: {xp?.approved ?? 0}</div>
            <div>XP pendente de validação: {xp?.pending ?? 0}</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(xp?.badges ?? []).map((b) => (
                <Badge key={b} variant="secondary">
                  {b}
                </Badge>
              ))}
              {(xp?.badges ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma badge conquistada.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Café Central — contribuições</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(dossier?.contributions ?? []).slice(0, 8).map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-2">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.kind}</div>
              </div>
            ))}
            {(dossier?.contributions ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Sem contribuições registradas.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico de avaliação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(history ?? []).slice(0, 10).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleDateString("pt-BR")} · {h.stage}
                </span>
                <Badge variant="outline">{h.concept ?? "—"}</Badge>
              </div>
            ))}
            {(history ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum registro de avaliação.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/instructor/dossier" className="text-accent hover:underline">
          Abrir dossiê completo
        </Link>
        <Link to="/instructor/evaluations" className="text-accent hover:underline">
          Avaliar I1–I6
        </Link>
        <Link to="/instructor/recovery" className="text-accent hover:underline">
          Recuperação
        </Link>
      </div>

      <AuditList entity="enrollments" entityId={enrollment?.id ?? null} title="Histórico administrativo" />
    </div>
  );
}
