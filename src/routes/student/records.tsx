import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDeleteBugReport, useMyBugReports } from "@/lib/techeduca";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/student/records")({
  head: () => ({
    meta: [
      { title: "Meus Registros | QA Academy" },
      {
        name: "description",
        content: "Histórico individual dos bugs registrados por você na trilha TechEduca.",
      },
      { property: "og:title", content: "Meus Registros | QA Academy" },
      {
        property: "og:description",
        content: "Todos os seus registros de bugs com passos, resultados e observações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: bugs, isPending } = useMyBugReports(userId);
  const remove = useDeleteBugReport(userId);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold">Meus Registros</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Histórico individual: apenas os registros criados por você aparecem aqui.
      </p>

      {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isPending && (bugs ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não registrou nenhum bug. Comece pela missão em Minhas Missões.
        </p>
      )}

      <div className="space-y-4">
        {(bugs ?? []).map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{b.feature}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {b.classification}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{b.problem}</p>
              {b.steps && (
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Passos
                  </span>
                  <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{b.steps}</pre>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Resultado esperado
                  </span>
                  <p className="text-muted-foreground">{b.expected_result || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Resultado obtido
                  </span>
                  <p className="text-muted-foreground">{b.obtained_result || "—"}</p>
                </div>
              </div>
              {b.note && (
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Observação
                  </span>
                  <p className="text-muted-foreground">{b.note}</p>
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  remove.mutate(b.id, {
                    onSuccess: () => toast.success("Registro removido."),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                Excluir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
