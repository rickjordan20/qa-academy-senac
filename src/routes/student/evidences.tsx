import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  openEvidenceFile,
  useDeleteEvidence,
  useMyBugReports,
  useMyEvidences,
} from "@/lib/techeduca";
import { EvidenceForm } from "@/components/techeduca/EvidenceForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/student/evidences")({
  head: () => ({
    meta: [
      { title: "Minhas Evidências | QA Academy" },
      {
        name: "description",
        content: "Arquivos e links que comprovam os problemas encontrados por você na trilha TechEduca.",
      },
      { property: "og:title", content: "Minhas Evidências | QA Academy" },
      {
        property: "og:description",
        content: "Suas evidências individuais: capturas, vídeos e links vinculados aos registros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvidencesPage,
});

function EvidencesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: evidences, isPending } = useMyEvidences(userId);
  const { data: bugs } = useMyBugReports(userId);
  const remove = useDeleteEvidence(userId);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Minhas Evidências</h1>
        <p className="text-sm text-muted-foreground">
          Suas evidências são privadas: apenas você e o instrutor da sua turma podem vê-las.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova evidência</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceForm userId={userId} runId={null} bugs={bugs ?? []} />
        </CardContent>
      </Card>

      {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isPending && (evidences ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma evidência registrada ainda.</p>
      )}

      <div className="space-y-3">
        {(evidences ?? []).map((ev) => (
          <div
            key={ev.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div>
              <div className="font-semibold">{ev.title}</div>
              {ev.description && (
                <p className="text-sm text-muted-foreground">{ev.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(ev.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  remove.mutate(ev, {
                    onSuccess: () => toast.success("Evidência removida."),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
