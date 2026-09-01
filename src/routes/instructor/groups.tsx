import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { NativeSelect } from "@/components/qa/TestCasesPanel";
import { AuditList } from "@/components/admin/AuditList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GROUP_STATUS,
  MEMBER_FUNCTIONS,
  labelOf,
  useAdminClasses,
  useAdminGroups,
  useGroupMemberActions,
  useRoster,
  useSaveGroup,
} from "@/lib/admin";

export const Route = createFileRoute("/instructor/groups")({
  head: () => ({
    meta: [
      { title: "Grupos | QA Academy" },
      {
        name: "description",
        content: "Crie grupos, defina QA Lead, mova integrantes e arquive equipes das turmas da UC10.",
      },
      { property: "og:title", content: "Grupos | QA Academy" },
      { property: "og:description", content: "Gestão de grupos, QA Leads e funções da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user } = useAuth();
  const { data: classes } = useAdminClasses(user?.id ?? null);
  const classIds = useMemo(() => (classes ?? []).map((c) => c.id), [classes]);
  const { data: groups } = useAdminGroups(classIds);
  const { data: roster } = useRoster(classIds);
  const saveGroup = useSaveGroup();
  const actions = useGroupMemberActions();

  const [classFilter, setClassFilter] = useState("all");
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("");

  const nameOf = new Map(
    (roster ?? []).map((r) => [r.student_id, r.profile?.full_name || r.profile?.email || "—"]),
  );
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const visible = (groups ?? []).filter((g) => classFilter === "all" || g.class_id === classFilter);

  const grouped = new Set(
    (groups ?? []).flatMap((g) => [
      ...(g.group_members ?? []).map((m) => m.student_id),
      ...(g.qa_lead_id ? [g.qa_lead_id] : []),
    ]),
  );
  const ungrouped = (roster ?? []).filter(
    (r) => !grouped.has(r.student_id) && (classFilter === "all" || r.class_id === classFilter),
  );

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const classId = newClass || (classes ?? [])[0]?.id;
    if (!classId) {
      toast.error("Crie uma turma primeiro.");
      return;
    }
    await saveGroup.mutateAsync({ values: { class_id: classId, name: newName, status: "active" } });
    setNewName("");
    toast.success("Grupo criado.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Grupos</h1>
        <p className="text-sm text-muted-foreground">
          Todo grupo pertence a uma turma. O QA Lead é uma função temporária de um aluno — não é outro tipo de
          conta e nunca atribui conceitos.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <NativeSelect
          id="gfilter"
          value={classFilter}
          onChange={setClassFilter}
          options={[
            { value: "all", label: "Todas as turmas" },
            ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <form className="flex gap-2" onSubmit={createGroup}>
          <Input required placeholder="Nome do novo grupo" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="w-44">
            <NativeSelect
              id="gclass"
              value={newClass || ((classes ?? [])[0]?.id ?? "")}
              onChange={setNewClass}
              options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <Button type="submit">Criar</Button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((g) => {
          const classMates = (roster ?? []).filter(
            (r) => r.class_id === g.class_id && !(g.group_members ?? []).some((m) => m.student_id === r.student_id),
          );
          return (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    {g.name}
                    <Badge variant={g.status === "active" ? "default" : "secondary"}>
                      {labelOf(GROUP_STATUS, g.status)}
                    </Badge>
                  </span>
                  <Link
                    to="/instructor/classes/$classId"
                    params={{ classId: g.class_id }}
                    className="text-xs font-normal text-accent hover:underline"
                  >
                    {classNameById.get(g.class_id)}
                  </Link>
                </CardTitle>
                <GroupNameEditor id={g.id} name={g.name} />
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">QA Lead</span>
                  <NativeSelect
                    id={`lead-${g.id}`}
                    value={g.qa_lead_id ?? ""}
                    onChange={(v) => actions.setQaLead.mutate({ groupId: g.id, studentId: v || null })}
                    options={[
                      { value: "", label: "Não definido" },
                      ...(g.group_members ?? []).map((m) => ({
                        value: m.student_id,
                        label: nameOf.get(m.student_id) ?? "—",
                      })),
                    ]}
                  />
                </div>

                {(g.group_members ?? []).map((m) => (
                  <div key={m.id} className="space-y-2 rounded-lg border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>{nameOf.get(m.student_id) ?? "—"}</span>
                      <Button variant="ghost" size="sm" onClick={() => actions.remove.mutate(m.id)}>
                        Remover
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <NativeSelect
                        id={`fn-${m.id}`}
                        value={m.member_function}
                        onChange={(v) => actions.setFunction.mutate({ memberId: m.id, fn: v })}
                        options={MEMBER_FUNCTIONS.map((f) => ({ value: f, label: f }))}
                      />
                      <NativeSelect
                        id={`mv-${m.id}`}
                        value={g.id}
                        onChange={(v) => actions.move.mutate({ memberId: m.id, groupId: v })}
                        options={(groups ?? [])
                          .filter((x) => x.class_id === g.class_id)
                          .map((x) => ({ value: x.id, label: `Mover → ${x.name}` }))}
                      />
                    </div>
                  </div>
                ))}
                {(g.group_members ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem integrantes.</p>
                )}

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Adicionar integrante</span>
                  <NativeSelect
                    id={`add-${g.id}`}
                    value=""
                    onChange={(v) => v && actions.add.mutate({ groupId: g.id, studentId: v })}
                    options={[
                      { value: "", label: "Selecione um aluno da turma" },
                      ...classMates.map((r) => ({
                        value: r.student_id,
                        label: r.profile?.full_name || r.profile?.email || "—",
                      })),
                    ]}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      saveGroup.mutate({
                        id: g.id,
                        values: { status: g.status === "active" ? "archived" : "active" },
                      })
                    }
                  >
                    {g.status === "active" ? "Arquivar grupo" : "Reativar grupo"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nenhum grupo nesta turma.</p>}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alunos sem grupo ({ungrouped.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ungrouped.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
              <span>
                {r.profile?.full_name || r.profile?.email}{" "}
                <span className="text-xs text-muted-foreground">· {classNameById.get(r.class_id)}</span>
              </span>
              <div className="w-56">
                <NativeSelect
                  id={`ug-${r.id}`}
                  value=""
                  onChange={(v) => v && actions.add.mutate({ groupId: v, studentId: r.student_id })}
                  options={[
                    { value: "", label: "Adicionar a um grupo" },
                    ...(groups ?? [])
                      .filter((g) => g.class_id === r.class_id)
                      .map((g) => ({ value: g.id, label: g.name })),
                  ]}
                />
              </div>
            </div>
          ))}
          {ungrouped.length === 0 && <p className="text-xs text-muted-foreground">Todos os alunos estão em grupos.</p>}
        </CardContent>
      </Card>

      <AuditList entity="groups" title="Histórico de grupos" />
    </div>
  );
}
