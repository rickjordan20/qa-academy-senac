import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/instructor/classes/$classId")({
  head: () => ({
    meta: [
      { title: "Detalhes da turma | QA Academy" },
      { name: "description", content: "Edite a turma, gerencie alunos e grupos da UC10." },
      { property: "og:title", content: "Detalhes da turma | QA Academy" },
      { property: "og:description", content: "Integrantes, grupos e QA Lead da turma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassDetail,
});

function ClassDetail() {
  const { classId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: turma } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["class-members", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_id")
        .eq("class_id", classId);
      if (error) throw error;
      const ids = (data ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", ids);
      if (pErr) throw pErr;
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((e) => ({ ...e, profile: map.get(e.student_id) ?? null }));
    },
  });

  const { data: groups } = useQuery({
    queryKey: ["class-groups", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, qa_lead_id, group_members(id, student_id, member_function)")
        .eq("class_id", classId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    if (turma) {
      setName(turma.name);
      setPeriod(turma.period ?? "");
      setDescription(turma.description ?? "");
    }
  }, [turma]);

  const nameById = new Map(
    (members ?? []).map((m) => [m.student_id, m.profile?.full_name || m.profile?.email || "—"]),
  );

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("classes")
      .update({ name, period: period || null, description: description || null })
      .eq("id", classId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Turma atualizada.");
    queryClient.invalidateQueries({ queryKey: ["class", classId] });
    queryClient.invalidateQueries({ queryKey: ["my-classes"] });
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("enroll_student_by_email", {
      _class_id: classId,
      _email: email,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail("");
    toast.success("Aluno cadastrado na turma.");
    queryClient.invalidateQueries({ queryKey: ["class-members", classId] });
    queryClient.invalidateQueries({ queryKey: ["my-classes"] });
  }

  async function removeStudent(enrollmentId: string) {
    const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Aluno removido da turma.");
    queryClient.invalidateQueries({ queryKey: ["class-members", classId] });
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("groups").insert({ class_id: classId, name: groupName });
    if (error) {
      toast.error(error.message);
      return;
    }
    setGroupName("");
    queryClient.invalidateQueries({ queryKey: ["class-groups", classId] });
  }

  async function setQaLead(groupId: string, studentId: string) {
    const { error } = await supabase
      .from("groups")
      .update({ qa_lead_id: studentId })
      .eq("id", groupId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["class-groups", classId] });
  }

  async function addGroupMember(groupId: string, studentId: string) {
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, student_id: studentId });
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["class-groups", classId] });
  }

  async function updateMemberFunction(memberId: string, fn: string) {
    const { error } = await supabase
      .from("group_members")
      .update({ member_function: fn })
      .eq("id", memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["class-groups", classId] });
  }

  return (
    <div className="space-y-6">
      <Link to="/instructor/classes" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar para turmas
      </Link>
      <h1 className="text-2xl font-bold">{turma?.name ?? "Turma"}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Editar turma</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveClass}>
              <div className="space-y-2">
                <Label htmlFor="n">Nome</Label>
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p">Período</Label>
                <Input id="p" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d">Descrição</Label>
                <Textarea
                  id="d"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit">Salvar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrantes ({members?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={addStudent}>
              <Input
                type="email"
                required
                placeholder="e-mail do aluno cadastrado"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit">Cadastrar</Button>
            </form>
            <div className="space-y-2">
              {(members ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">{m.profile?.full_name || "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeStudent(m.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))}
              {(members ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grupos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={createGroup}>
            <Input
              required
              placeholder="Nome do grupo"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <Button type="submit">Criar grupo</Button>
          </form>

          <div className="grid gap-4 md:grid-cols-2">
            {(groups ?? []).map((g) => (
              <div key={g.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{g.name}</h3>
                  <span className="text-xs text-accent">
                    QA Lead: {g.qa_lead_id ? nameById.get(g.qa_lead_id) : "não definido"}
                  </span>
                </div>

                <div className="space-y-2">
                  {(g.group_members ?? []).map((gm) => (
                    <div key={gm.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{nameById.get(gm.student_id)}</span>
                      <Input
                        className="h-8 w-36"
                        defaultValue={gm.member_function}
                        onBlur={(e) => updateMemberFunction(gm.id, e.target.value)}
                      />
                    </div>
                  ))}
                  {(g.group_members ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem integrantes.</p>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select onValueChange={(v) => addGroupMember(g.id, v)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Adicionar integrante" />
                    </SelectTrigger>
                    <SelectContent>
                      {(members ?? []).map((m) => (
                        <SelectItem key={m.student_id} value={m.student_id}>
                          {m.profile?.full_name || m.profile?.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(v) => setQaLead(g.id, v)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Definir QA Lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {(g.group_members ?? []).map((gm) => (
                        <SelectItem key={gm.id} value={gm.student_id}>
                          {nameById.get(gm.student_id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {(groups ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum grupo criado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
