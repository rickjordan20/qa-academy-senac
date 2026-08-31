import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

const items = [
  { to: "/student/dashboard", label: "Início" },
  { to: "/student/journey", label: "Minha Jornada" },
  { to: "/student/activities", label: "Missões da Turma" },
  { to: "/student/missions", label: "Minhas Missões" },
  { to: "/student/cafe", label: "Café Central" },
  { to: "/student/inventory", label: "Inventário da Aplicação" },
  { to: "/student/qa", label: "Módulos QA" },
  { to: "/student/records", label: "Meus Registros" },
  { to: "/student/evidences", label: "Minhas Evidências" },
  { to: "/student/ranking", label: "Ranking" },
  { to: "/student/progress", label: "Meu Progresso" },
  { to: "/student/evaluation", label: "Minha Avaliação" },
  { to: "/student/portfolio", label: "Meu Portfólio" },
  { to: "/student/profile", label: "Perfil" },
];

export const Route = createFileRoute("/student")({
  ssr: false,
  component: () => (
    <RoleGate allow="student">
      <AppShell items={items} homeTo="/student/dashboard" badge="Aluno">
        <Outlet />
      </AppShell>
    </RoleGate>
  ),
});
