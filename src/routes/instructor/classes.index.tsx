import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyClasses } from "@/lib/uc10";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/classes/")({
  head: () => ({
    meta: [
      { title: "Turmas | QA Academy" },
      { name: "description", content: "Crie e gerencie as turmas da UC10 sob sua responsabilidade." },
      { property: "og:title", content: "Turmas | QA Academy" },
      { property: "og:description", content: "Gestão de turmas e alunos da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("classes").insert({
      name,
      period: period || null,
      description: description || null,
      instructor_id: user!.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setPeriod("");
    setDescription("");
    toast.success("Turma criada.");
    queryClient.invalidateQueries({ queryKey: ["my-classes"] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Turmas</h1>
        <div className="space-y-3">
          {(classes ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
          )}
          {(classes ?? []).map((c) => (
            <Link
              key={c.id}
              to="/instructor/classes/$classId"
              params={{ classId: c.id }}
              className="block rounded-xl border border-border bg-surface p-4 hover:border-primary"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">{c.period || "Sem período"}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{c.enrollments?.length ?? 0} alunos</div>
                  <div>{c.groups?.length ?? 0} grupos</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Nova turma</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={createClass}>
            <div className="space-y-2">
              <Label htmlFor="n">Nome</Label>
              <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">Período</Label>
              <Input
                id="p"
                placeholder="2026.1 - Noturno"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d">Descrição</Label>
              <Textarea
                id="d"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              Criar turma
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
