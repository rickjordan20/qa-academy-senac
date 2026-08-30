import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirmando conta | QA Academy" },
      { name: "description", content: "Validando a confirmação de e-mail da sua conta QA Academy." },
      { property: "og:title", content: "Confirmando conta | QA Academy" },
      { property: "og:description", content: "Confirmação de conta da plataforma QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirmando sua conta...");

  useEffect(() => {
    let active = true;
    (async () => {
      // Dá tempo do SDK processar o token do link (hash ou code).
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => null);
      }
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 800));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!active) return;

      if (!session) {
        setMessage("Conta confirmada com sucesso. Faça login para continuar.");
        setTimeout(() => navigate({ to: "/login", replace: true }), 1800);
        return;
      }

      if (!active) return;
      navigate({ to: "/dashboard", replace: true });
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">QA Academy</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
