import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyEnrollment } from "@/lib/uc10";
import { useMyGroups } from "@/lib/cafe";
import {
  useFeedbacks,
  useGroupPortfolio,
  useStudentDossier,
  useClassEvaluations,
  type EvaluationRow,
  type IndicatorRow,
} from "@/lib/assessment";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/student/portfolio")({
  head: () => ({
    meta: [
      { title: "Meu portfólio | QA Academy" },
      {
        name: "description",
        content: "Portfólio individual e do grupo com missões, casos, bugs, evidências e retestes.",
      },
      { property: "og:title", content: "Meu portfólio | QA Academy" },
      { property: "og:description", content: "Tudo que você produziu na UC10 em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { user } = useAuth();
  const { data: enrollment } = useMyEnrollment(user?.id ?? null);
  const { data: dossier } = useStudentDossier(user?.id ?? null);
  const { data: feedbacks } = useFeedbacks(user?.id ?? null);
  const { data: indicators } = useIndicators();
  const { data: evaluations } = useClassEvaluations(enrollment?.class_id ?? null);
  const { data: groups } = useMyGroups(user?.id ?? null);
  const group = groups?.[0] ?? null;
  const { data: portfolio } = useGroupPortfolio(group?.id ?? null);

  const inds = (indicators ?? []) as IndicatorRow[];
  const evMap = new Map<string, EvaluationRow>(
    (evaluations ?? []).filter((e) => e.student_id === user?.id).map((e) => [e.indicator_id, e]),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Meu portfólio</h1>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          Imprimir / PDF
        </Button>
      </div>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="grupo">Grupo</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="grid gap-4 pt-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Indicadores</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              {inds.map((i) => (
                <span key={i.id} className="flex items-center gap-1">
                  <span className="font-semibold text-primary">{i.code}</span>
                  <ConceptBadge concept={evMap.get(i.id)?.concept ?? null} />
                </span>
              ))}
            </CardContent>
          </Card>
          <Block
            title="Missões"
            items={(dossier?.runs ?? []).map((r) => {
              const m = (dossier?.missions ?? []).find((x) => x.id === r.mission_id);
              return `${m?.title ?? r.mission_id} — ${r.status}`;
            })}
          />
          <Block title="Funções e tarefas" items={(dossier?.tasks ?? []).map((t) => `${t.area}: ${t.title}`)} />
          <Block title="Casos de teste" items={(dossier?.cases ?? []).map((c) => `${c.title} (${c.status})`)} />
          <Block title="Bugs" items={(dossier?.bugs ?? []).map((b) => `${b.title} (${b.status})`)} />
          <Block
            title="Evidências"
            items={[
              ...(dossier?.teEvidences ?? []).map((e) => e.title),
              ...(dossier?.qaEvidences ?? []).map((e) => `${e.title} (${e.kind})`),
            ]}
          />
          <Block title="Retestes" items={(dossier?.retests ?? []).map((r) => `Reteste: ${r.result}`)} />
          <Block title="Feedback do instrutor" items={(feedbacks ?? []).map((f) => f.message)} />
        </TabsContent>

        <TabsContent value="grupo" className="grid gap-4 pt-4 md:grid-cols-2">
          {!group && (
            <p className="text-sm text-muted-foreground">Você ainda não faz parte de um grupo.</p>
          )}
          {group && (
            <>
              <Block
                title="Integrantes"
                items={(group.members ?? []).map(
                  (m) => `${m.full_name || m.email} — ${m.member_function}${m.is_qa_lead ? " (QA Lead)" : ""}`,
                )}
              />
              <Block
                title="Plano de tarefas"
                items={(portfolio?.tasks ?? []).map((t) => `${t.title} — ${t.area} — ${t.status}`)}
              />
              <Block
                title="Casos de teste"
                items={(portfolio?.cases ?? []).map((c) => `${c.title} (${c.status})`)}
              />
              <Block
                title="Bugs"
                items={(portfolio?.bugs ?? []).map((b) => `${b.title} — ${b.severity} — ${b.status}`)}
              />
              <Block
                title="Evidências"
                items={(portfolio?.evidences ?? []).map((e) => `${e.title} (${e.kind})`)}
              />
              <Block
                title="Relatório do grupo"
                items={portfolio?.run?.deliverable ? [portfolio.run.deliverable] : []}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
