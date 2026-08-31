import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useCafeMission, useMyGroups } from "@/lib/cafe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/student/cafe/")({
  head: () => ({
    meta: [
      { title: "Café Central | QA Academy" },
      {
        name: "description",
        content: "Trilha Café Central: prática autônoma em grupo com QA Lead, tarefas e entrega coletiva.",
      },
      { property: "og:title", content: "Café Central | QA Academy" },
      {
        property: "og:description",
        content: "Desafio QA em grupo: distribuição de áreas, contribuições individuais e entrega coletiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CafeIndex,
});

function CafeIndex() {
  const { user } = useAuth();
  const { data: mission } = useCafeMission();
  const { data: groups, isPending } = useMyGroups(user?.id ?? null);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Trilha Café Central
        </span>
        <h1 className="mt-1 text-2xl font-bold">Prática autônoma em grupo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O grupo se organiza sozinho: o QA Lead distribui as áreas e as tarefas, cada integrante
          investiga a sua parte e registra a própria contribuição, e o grupo entrega o resultado
          coletivo.
        </p>
      </div>

      {mission && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{mission.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{mission.objective}</p>
          </CardContent>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Meus grupos
      </h2>

      {isPending && <p className="text-sm text-muted-foreground">Carregando grupos...</p>}
      {!isPending && (groups ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não faz parte de um grupo. Peça ao instrutor para incluir você em um grupo da
          sua turma.
        </p>
      )}

      <div className="space-y-4">
        {(groups ?? []).map((g) => {
          const isLead = g.qa_lead_id === user?.id;
          return (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {isLead ? "Você é QA Lead" : "Integrante"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Turma: {g.class_name || "—"} · {g.members.length} integrante(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.members.map((m) => (
                    <span
                      key={m.student_id}
                      className="rounded-full border border-border px-2 py-0.5 text-xs"
                    >
                      {m.full_name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {m.is_qa_lead ? "QA Lead" : m.member_function}
                      </span>
                    </span>
                  ))}
                </div>
                <Button asChild size="sm">
                  <Link to="/student/cafe/$groupId" params={{ groupId: g.id }}>
                    Abrir painel do grupo
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
