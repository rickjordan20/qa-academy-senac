import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRole, useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil | QA Academy" },
      { name: "description", content: "Atualize nome, avatar e veja sua turma e perfil de acesso." },
      { property: "og:title", content: "Meu perfil | QA Academy" },
      { property: "og:description", content: "Dados pessoais, turma e perfil na QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: role } = useRole();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const { data: turma } = useQuery({
    queryKey: ["my-class", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("classes(name)")
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, avatar_url: avatarUrl || null })
      .eq("id", user!.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil atualizado.");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Meu perfil</h1>
      <Card>
        <CardHeader>
          <CardDescription>Dados da sua conta</CardDescription>
          <CardTitle className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-12 w-12 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg">
                {(fullName || profile?.email || "?").charAt(0).toUpperCase()}
              </span>
            )}
            {fullName || profile?.email}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor="fn">Nome</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em">E-mail</Label>
              <Input id="em" value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="av">Avatar (URL opcional)</Label>
              <Input id="av" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Turma</Label>
                <Input value={turma?.classes?.name ?? "—"} disabled />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Input value={role === "instructor" ? "Instrutor" : "Aluno"} disabled />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              Salvar alterações
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
