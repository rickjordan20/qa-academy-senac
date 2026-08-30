import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

const items = [
  { to: "/student/dashboard", label: "Início" },
  { to: "/student/journey", label: "Minha Jornada" },
  { to: "/student/progress", label: "Meu Progresso" },
  { to: "/student/evaluation", label: "Minha Avaliação" },
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
