import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

const items = [
  { to: "/instructor/dashboard", label: "Dashboard" },
  { to: "/instructor/classes", label: "Turmas" },
  { to: "/instructor/students", label: "Alunos" },
  { to: "/instructor/groups", label: "Grupos" },
  { to: "/instructor/cafe", label: "Café Central" },
  { to: "/instructor/qa", label: "Módulos QA" },
  { to: "/instructor/gamification", label: "Gamificação" },
  { to: "/instructor/evaluations", label: "Matriz de Avaliação" },
  { to: "/instructor/dossier", label: "Dossiê do Aluno" },
  { to: "/instructor/final", label: "Avaliação Final" },
  { to: "/instructor/recovery", label: "Recuperação" },
  { to: "/instructor/portfolios", label: "Portfólios" },
  { to: "/instructor/reports", label: "Relatórios" },
  { to: "/instructor/profile", label: "Perfil" },
];

export const Route = createFileRoute("/instructor")({
  ssr: false,
  component: () => (
    <RoleGate allow="instructor">
      <AppShell items={items} homeTo="/instructor/dashboard" badge="Instrutor">
        <Outlet />
      </AppShell>
    </RoleGate>
  ),
});
