import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile, useRole } from "@/lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: role } = useRole();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="text-lg font-bold tracking-tight">
            QA<span className="text-accent">Academy</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <Link
              to="/dashboard"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
            >
              Dashboard
            </Link>
            {role === "instructor" && (
              <Link
                to="/turmas"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              >
                Turmas
              </Link>
            )}
            <Link
              to="/perfil"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
            >
              Perfil
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.full_name || profile?.email}
            </span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
