import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

const items = [
  { to: "/instructor/dashboard", label: "Dashboard" },
  { to: "/instructor/classes", label: "Turmas" },
  { to: "/instructor/students", label: "Alunos" },
  { to: "/instructor/groups", label: "Grupos" },
  { to: "/instructor/evaluations", label: "Avaliações" },
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
