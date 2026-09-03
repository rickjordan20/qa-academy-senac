import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useMyClasses } from "@/lib/uc10";
import { useClassMissions, useMissionReport } from "@/lib/mission-report";
import { generateMissionReportPdf } from "@/lib/mission-report-pdf";
import { fmtDateTime } from "@/lib/mission-submissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/reports/deliveries")({
  head: () => ({
    meta: [
      { title: "Entregas por Missão | QA Academy" },
      {
        name: "description",
        content: "Gere um PDF consolidado com as entregas, indicadores por bloco, avaliações, XP e feedback de uma missão.",
      },
      { property: "og:title", content: "Entregas por Missão | QA Academy" },
      { property: "og:description", content: "Relatório em PDF das entregas de qualquer missão da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveriesReportPage,
});

function DeliveriesReportPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string>("");
  const [missionId, setMissionId] = useState<string>("");
  const activeClass = classId || classes?.[0]?.id || "";
  const { data: missions } = useClassMissions(activeClass || null);
  const { data: report, isFetching } = useMissionReport(activeClass || null, missionId || null);

  const mission = useMemo(() => (missions ?? []).find((m) => m.id === missionId) ?? null, [missions, missionId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entregas por Missão</h1>
          <p className="text-sm text-muted-foreground">
            Selecione a turma e a missão para gerar um PDF consolidado das entregas (somente leitura).
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/instructor/reports">Voltar aos relatórios</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Turma</span>
            <select
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              value={activeClass}
              onChange={(e) => {
                setClassId(e.target.value);
                setMissionId("");
              }}
            >
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {(classes ?? []).length === 0 && <option value="">Nenhuma turma</option>}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Missão</span>
            <select
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
            >
              <option value="">Selecione uma missão...</option>
              {(missions ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.lesson_number ? `Aula ${m.lesson_number} — ` : ""}
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {mission && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{mission.title}</CardTitle>
            <Button
              size="sm"
              disabled={!report || isFetching}
              onClick={() => {
                if (!report) return;
                try {
                  generateMissionReportPdf(report);
                } catch (err) {
                  console.error("[relatorio-entregas]", err);
                  toast.error("Não foi possível gerar o PDF.");
                }
              }}
            >
              {isFetching ? "Carregando dados..." : "Gerar PDF das entregas"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Modalidade: <strong>{report?.isGroup ? "Grupo" : "Individual"}</strong> · Abertura:{" "}
              {fmtDateTime(mission.opens_at)} · Prazo: {fmtDateTime(mission.due_at)} · XP base: {mission.base_xp ?? 0}
            </p>
            {report && (
              <ul className="grid gap-1 sm:grid-cols-2">
                <li>Total esperado de entregas: {report.summary.expected}</li>
                <li>Entregas realizadas: {report.summary.delivered}</li>
                <li>Não iniciadas: {report.summary.notStarted}</li>
                <li>Em andamento: {report.summary.inProgress}</li>
                <li>Aguardando avaliação: {report.summary.awaiting}</li>
                <li>Em avaliação: {report.summary.inReview}</li>
                <li>Avaliadas: {report.summary.evaluated}</li>
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
