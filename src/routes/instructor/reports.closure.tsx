import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useMyClasses } from "@/lib/uc10";
import { useClosureReport } from "@/lib/closure-report";
import { generateClosureReportPdf } from "@/lib/closure-report-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/reports/closure")({
  head: () => ({
    meta: [
      { title: "Fechamento da UC10 | QA Academy" },
      {
        name: "description",
        content:
          "Gere o PDF de fechamento da UC10 com indicadores I1–I6, etapas, histórico, recuperação, resultado D/ND e XP informativo.",
      },
      { property: "og:title", content: "Fechamento da UC10 | QA Academy" },
      { property: "og:description", content: "Relatório de fechamento por aluno ou turma completa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClosureReportPage,
});

function ClosureReportPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("all");
  const activeClass = classId || classes?.[0]?.id || "";
  const { data: report, isFetching } = useClosureReport(activeClass || null);

  const students = report?.students ?? [];
  const selected = studentId === "all" ? students : students.filter((s) => s.id === studentId);

  function handleGenerate() {
    if (!report) return;
    if (!selected.length) {
      toast.error("Nenhum aluno para incluir no relatório.");
      return;
    }
    generateClosureReportPdf(report, selected);
    toast.success("Relatório de fechamento gerado.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fechamento da UC10</h1>
          <p className="text-sm text-muted-foreground">
            PDF consolidado por aluno ou turma completa — somente leitura, sem alterar nenhuma avaliação.
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
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              value={activeClass}
              onChange={(e) => {
                setClassId(e.target.value);
                setStudentId("all");
              }}
            >
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Escopo</span>
            <select
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="all">Turma completa</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Resumo</CardTitle>
          <Button size="sm" onClick={handleGenerate} disabled={!report || isFetching}>
            {isFetching ? "Carregando..." : "Gerar PDF"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!report ? (
            <p className="text-muted-foreground">Selecione uma turma.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Info label="Alunos" value={report.summary.total} />
                <Info label="Em andamento" value={report.summary.inProgress + report.summary.finalOpen} />
                <Info label="Necessitam Recuperação Final" value={report.summary.needsRecovery} />
                <Info label="Em Recuperação Final" value={report.summary.inRecovery} />
                <Info label="Desenvolvido (D)" value={report.summary.d} />
                <Info label="Não Desenvolvido (ND)" value={report.summary.nd} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="p-2">Aluno</th>
                      <th className="p-2">Situação</th>
                      <th className="p-2">Resultado</th>
                      <th className="p-2">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="p-2">{s.name}</td>
                        <td className="p-2">{s.situation.label}</td>
                        <td className="p-2">{s.result?.final_result ?? "—"}</td>
                        <td className="p-2">{s.xpTotal}</td>
                      </tr>
                    ))}
                    {!selected.length && (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={4}>
                          Sem alunos nesta turma.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
