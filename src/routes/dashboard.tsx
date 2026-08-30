import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrando na sua conta | QA Academy" },
      { name: "description", content: "Redirecionamento para a área correta da QA Academy." },
      { property: "og:title", content: "Entrando na sua conta | QA Academy" },
      { property: "og:description", content: "Redirecionamento por perfil na QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoleRedirect,
});

function RoleRedirect() {
  const { loading, session, role, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (role) {
      console.info("[auth] redirecionando para", homeForRole(role));
      navigate({ to: homeForRole(role), replace: true });
    }
  }, [loading, session, role, navigate]);

  if (!loading && session && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold">Não foi possível abrir seu painel</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login", replace: true });
            }}
          >
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        Entrando na sua conta...
      </div>
    </div>
  );
}
