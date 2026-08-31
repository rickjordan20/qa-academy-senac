import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { NativeSelect } from "@/components/qa/TestCasesPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ENROLLMENT_STATUS,
  labelOf,
  useAdminClasses,
  useAdminGroups,
  useRemoveEnrollment,
  useRoster,
  useUpdateEnrollment,
} from "@/lib/admin";

export const Route = createFileRoute("/instructor/students/")({
  head: () => ({
    meta: [
      { title: "Alunos | QA Academy" },
      {
        name: "description",
        content: "Pesquise, filtre, transfira e acompanhe a situação administrativa dos alunos da UC10.",
      },
      { property: "og:title", content: "Alunos | QA Academy" },
      { property: "og:description", content: "Gestão completa dos alunos da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { user } = useAuth();
  const { data: classes } = useAdminClasses(user?.id ?? null);
  const classIds = useMemo(() => (classes ?? []).map((c) => c.id), [classes]);
  const { data: roster } = useRoster(classIds);
  const { data: groups } = useAdminGroups(classIds);
  const updateEnrollment = useUpdateEnrollment();
  const removeEnrollment = useRemoveEnrollment();

  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const groupByStudent = new Map<string, string>();
  for (const g of groups ?? []) {
    for (const m of g.group_members ?? []) groupByStudent.set(m.student_id, g.name);
    if (g.qa_lead_id) groupByStudent.set(g.qa_lead_id, `${g.name} (QA Lead)`);
  }

  const rows = (roster ?? []).filter((r) => {
    const term = q.trim().toLowerCase();
    const name = `${r.profile?.full_name ?? ""} ${r.profile?.email ?? ""} ${r.student_code ?? ""}`.toLowerCase();
    return (
      (classFilter === "all" || r.class_id === classFilter) &&
      (statusFilter === "all" || r.status === statusFilter) &&
      (!term || name.includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Alunos</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} aluno(s) listado(s). Abra um aluno para ver a visão 360°: jornada, evidências,
          indicadores, XP e avaliação.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Pesquisar por nome, e-mail ou matrícula" value={q} onChange={(e) => setQ(e.target.value)} />
        <NativeSelect
          id="cls"
          value={classFilter}
          onChange={setClassFilter}
          options={[
            { value: "all", label: "Todas as turmas" },
            ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <NativeSelect
          id="sts"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ value: "all", label: "Todas as situações" }, ...ENROLLMENT_STATUS.map((s) => ({ ...s }))]}
        />
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  to="/instructor/students/$studentId"
                  params={{ studentId: r.student_id }}
                  className="font-semibold hover:text-accent"
                >
                  {r.profile?.full_name || r.profile?.email || "Sem nome"}
                </Link>
                <p className="text-xs text-muted-foreground">{r.profile?.email}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{classNameById.get(r.class_id) ?? "—"}</Badge>
                  <Badge variant="secondary">{groupByStudent.get(r.student_id) ?? "Sem grupo"}</Badge>
                  <Badge>{labelOf(ENROLLMENT_STATUS, r.status)}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-9 w-32"
                  placeholder="Matrícula"
                  defaultValue={r.student_code ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (r.student_code ?? "") &&
                    updateEnrollment.mutate({ id: r.id, values: { student_code: e.target.value || null } })
                  }
                />
                <div className="w-44">
                  <NativeSelect
                    id={`st-${r.id}`}
                    value={r.status}
                    onChange={(v) => updateEnrollment.mutate({ id: r.id, values: { status: v } })}
                    options={ENROLLMENT_STATUS.map((s) => ({ ...s }))}
                  />
                </div>
                <div className="w-48">
                  <NativeSelect
                    id={`tr-${r.id}`}
                    value={r.class_id}
                    onChange={(v) => {
                      updateEnrollment.mutate(
                        { id: r.id, values: { class_id: v, status: "transferred" } },
                        { onSuccess: () => toast.success("Aluno transferido de turma.") },
                      );
                    }}
                    options={(classes ?? []).map((c) => ({ value: c.id, label: `Transferir → ${c.name}` }))}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    removeEnrollment.mutate(r.id, { onSuccess: () => toast.success("Aluno removido da turma.") })
                  }
                >
                  Remover
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
