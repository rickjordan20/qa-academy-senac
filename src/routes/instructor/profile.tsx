import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/profile")({
  head: () => ({
    meta: [
      { title: "Perfil do instrutor | QA Academy" },
      { name: "description", content: "Dados da conta administrativa do instrutor da QA Academy." },
      { property: "og:title", content: "Perfil do instrutor | QA Academy" },
      { property: "og:description", content: "Nome, e-mail e tipo de conta do instrutor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorProfile,
});

function InstructorProfile() {
  const { user, profile, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? "");
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user!.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil atualizado.");
    refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Meu perfil</h1>
      <Card>
        <CardHeader>
          <CardDescription>Conta administrativa</CardDescription>
          <CardTitle>{profile?.full_name || profile?.email}</CardTitle>
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
              <Label>Tipo de conta</Label>
              <Input value="Instrutor" disabled />
              <p className="text-xs text-muted-foreground">
                O tipo de conta é definido no banco de dados e não pode ser alterado pela interface.
              </p>
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
