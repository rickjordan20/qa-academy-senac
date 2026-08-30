import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, homeForRole, type AppRole } from "@/lib/auth";

function FullScreenMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        {text}
      </div>
    </div>
  );
}

/** Libera a interface somente depois de sessão + profile + papel resolvidos. */
export function RoleGate({ allow, children }: { allow: AppRole; children: React.ReactNode }) {
  const { loading, session, profile, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (role && role !== allow) {
      navigate({ to: homeForRole(role), replace: true });
    }
  }, [loading, session, role, allow, navigate]);

  if (loading || !session) return <FullScreenMessage text="Carregando sua conta..." />;
  if (!role || !profile) return <FullScreenMessage text="Estamos configurando seu perfil." />;
  if (role !== allow) return <FullScreenMessage text="Carregando sua conta..." />;

  return <>{children}</>;
}
