import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import { useInstructorGroups } from "@/lib/cafe";
import {
  useClassEvaluations,
  useClassStudents,
  useFeedbacks,
  useGroupPortfolio,
  useStudentDossier,
  type EvaluationRow,
  type IndicatorRow,
} from "@/lib/assessment";
import { useProfileNames } from "@/lib/qa";
import { ClassPicker } from "@/components/eval/ClassPicker";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/instructor/portfolios")({
  head: () => ({
    meta: [
      { title: "Portfólios | QA Academy" },
      {
        name: "description",
        content: "Portfólio individual e portfólio do grupo com missões, casos, bugs e evidências.",
      },
      { property: "og:title", content: "Portfólios | QA Academy" },
      { property: "og:description", content: "Consolidação das entregas de alunos e grupos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfoliosPage,
});

function PortfoliosPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const active = classId ?? classes?.[0]?.id ?? null;
  const { data: students } = useClassStudents(active);
  const { data: groups } = useInstructorGroups(user?.id ?? null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const student = (students ?? []).find((s) => s.id === studentId) ?? students?.[0] ?? null;
  const group = (groups ?? []).find((g) => g.id === groupId) ?? groups?.[0] ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portfólios</h1>
          <p className="text-sm text-muted-foreground">
            Consolidação das entregas individuais e coletivas.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          Imprimir / PDF
        </Button>
      </div>

      <ClassPicker classes={classes} value={active} onChange={setClassId} />

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="grupo">Grupo</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="pt-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {(students ?? []).map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={student?.id === s.id ? "default" : "outline"}
                onClick={() => setStudentId(s.id)}
              >
                {s.full_name || s.email}
              </Button>
            ))}
          </div>
          {student && <IndividualPortfolio classId={active} studentId={student.id} name={student.full_name || student.email} />}
        </TabsContent>

        <TabsContent value="grupo" className="pt-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {(groups ?? []).map((g) => (
              <Button
                key={g.id}
                size="sm"
                variant={group?.id === g.id ? "default" : "outline"}
                onClick={() => setGroupId(g.id)}
              >
                {g.name}
              </Button>
            ))}
            {(groups ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</p>
            )}
          </div>
          {group && <GroupPortfolioView groupId={group.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function IndividualPortfolio({
  classId,
  studentId,
  name,
}: {
  classId: string | null;
  studentId: string;
  name: string;
}) {
  const { data: dossier } = useStudentDossier(studentId);
  const { data: indicators } = useIndicators();
  const { data: evaluations } = useClassEvaluations(classId);
  const { data: feedbacks } = useFeedbacks(studentId);
  const inds = (indicators ?? []) as IndicatorRow[];
  const evMap = new Map<string, EvaluationRow>(
    (evaluations ?? []).filter((e) => e.student_id === studentId).map((e) => [e.indicator_id, e]),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Portfólio de {name}</CardTitle>
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
      <Block title="Funções no grupo" items={(dossier?.tasks ?? []).map((t) => `${t.area}: ${t.title}`)} />
      <Block title="Casos de teste" items={(dossier?.cases ?? []).map((c) => `${c.title} (${c.status})`)} />
      <Block
        title="Execuções"
        items={(dossier?.cases ?? [])
          .filter((c) => c.status !== "nao_executado")
          .map((c) => `${c.title} — ${c.status}`)}
      />
      <Block title="Bugs" items={(dossier?.bugs ?? []).map((b) => `${b.title} (${b.status})`)} />
      <Block
        title="Evidências"
        items={[
          ...(dossier?.teEvidences ?? []).map((e) => e.title),
          ...(dossier?.qaEvidences ?? []).map((e) => `${e.title} (${e.kind})`),
        ]}
      />
      <Block title="Retestes" items={(dossier?.retests ?? []).map((r) => `Reteste: ${r.result}`)} />
      <Block title="Feedback" items={(feedbacks ?? []).map((f) => f.message)} />
    </div>
  );
}

function GroupPortfolioView({ groupId }: { groupId: string }) {
  const { data } = useGroupPortfolio(groupId);
  const ids = [
    ...(data?.members ?? []).map((m) => m.student_id),
    ...(data?.contributions ?? []).map((c) => c.student_id),
  ];
  const { data: names } = useProfileNames(ids);
  const nameOf = (id: string) => names?.[id] ?? id.slice(0, 8);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{data?.group?.name ?? "Grupo"}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Entrega: {data?.run?.status ?? "não iniciada"}
          {data?.run?.submitted_at &&
            ` · enviada em ${new Date(data.run.submitted_at).toLocaleDateString("pt-BR")}`}
        </CardContent>
      </Card>
      <Block
        title="Integrantes"
        items={(data?.members ?? []).map(
          (m) =>
            `${nameOf(m.student_id)} — ${m.member_function}${
              data?.group?.qa_lead_id === m.student_id ? " (QA Lead)" : ""
            }`,
        )}
      />
      <Block
        title="Plano de tarefas"
        items={(data?.tasks ?? []).map(
          (t) => `${t.title} — ${t.area} — ${t.status}${t.assignee_id ? ` — ${nameOf(t.assignee_id)}` : ""}`,
        )}
      />
      <Block title="Casos de teste" items={(data?.cases ?? []).map((c) => `${c.title} (${c.status})`)} />
      <Block
        title="Bugs"
        items={(data?.bugs ?? []).map((b) => `${b.title} — ${b.severity} — ${b.status}`)}
      />
      <Block
        title="Evidências"
        items={(data?.evidences ?? []).map((e) => `${e.title} (${e.kind}) — ${nameOf(e.author_id)}`)}
      />
      <Block
        title="Relatório / contribuições"
        items={[
          ...(data?.run?.deliverable ? [data.run.deliverable] : []),
          ...(data?.contributions ?? []).map((c) => `${nameOf(c.student_id)}: ${c.title} (${c.kind})`),
        ]}
      />
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
