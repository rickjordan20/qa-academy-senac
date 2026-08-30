import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "instructor" | "student";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  /** true quando a busca de perfil/papel terminou (com sucesso ou erro). */
  resolved: boolean;
  error: string | null;
  refresh: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const queryClient = useQueryClient();

  // Um único listener de autenticação em toda a aplicação.
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      setSessionLoading(false);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user?.id ?? null;

  // Perfil + papel buscados UMA única vez por sessão.
  const account = useQuery({
    queryKey: ["account", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (rolesRes.error) throw rolesRes.error;

      let profile = profileRes.data as Profile | null;

      // Usuário autenticado sem profile: sincroniza com segurança (sem tocar no papel).
      if (!profile) {
        const meta = session?.user?.user_metadata ?? {};
        const { data: created } = await supabase
          .from("profiles")
          .insert({
            id: userId!,
            full_name: (meta["full_name"] as string) ?? "",
            email: session?.user?.email ?? "",
          })
          .select("id, full_name, email, avatar_url")
          .maybeSingle();
        profile = (created as Profile | null) ?? null;
      }

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const role: AppRole | null = roles.includes("instructor")
        ? "instructor"
        : roles.includes("student")
          ? "student"
          : null;

      return { profile, role };
    },
  });

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    profile: account.data?.profile ?? null,
    role: account.data?.role ?? null,
    loading: sessionLoading || (!!userId && account.isPending),
    refresh: () => queryClient.invalidateQueries({ queryKey: ["account", userId] }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export function homeForRole(role: AppRole | null) {
  return role === "instructor" ? "/instructor/dashboard" : "/student/dashboard";
}
