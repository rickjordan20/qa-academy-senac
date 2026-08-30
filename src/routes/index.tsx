import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "QA Academy | UC10 — Testes de software" },
      {
        name: "description",
        content: "Plataforma da UC10 – Realizar testes nas aplicações desenvolvidas.",
      },
      { property: "og:title", content: "QA Academy | UC10 — Testes de software" },
      { property: "og:description", content: "Turmas, grupos e indicadores I1–I6 da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/login", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Carregando sua conta...</p>
    </div>
  );
}
