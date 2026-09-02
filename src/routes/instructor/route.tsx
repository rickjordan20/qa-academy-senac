import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, Home, Settings, TestTube2 } from "lucide-react";
import { AppShell, type NavGroup, type NavItem } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

/** Todas as rotas do instrutor (mantidas exatamente como já existiam). */
const items: NavItem[] = [
  { to: "/instructor/dashboard", label: "Dashboard" },
  { to: "/instructor/classes", label: "Turmas" },
  { to: "/instructor/students", label: "Alunos" },
  { to: "/instructor/groups", label: "Grupos" },
  { to: "/instructor/cafe", label: "Café Central" },
  { to: "/instructor/missions", label: "Missões" },
  { to: "/instructor/async", label: "Atividades Assíncronas" },
  { to: "/instructor/submissions", label: "Central de Avaliação" },
  { to: "/instructor/features", label: "Funcionalidades" },
  { to: "/instructor/inventory", label: "Inventário" },
  { to: "/instructor/qa", label: "Módulos QA" },
  { to: "/instructor/gamification", label: "Gamificação" },
  { to: "/instructor/badges", label: "Badges" },
  { to: "/instructor/evaluations", label: "Matriz de Avaliação" },
  { to: "/instructor/dossier", label: "Dossiê do Aluno" },
  { to: "/instructor/final", label: "Avaliação Final" },
  { to: "/instructor/recovery", label: "Recuperação" },
  { to: "/instructor/portfolios", label: "Portfólios" },
  { to: "/instructor/reports", label: "Relatórios" },
  { to: "/instructor/profile", label: "Perfil" },
];

/** Agrupamento apenas visual do menu — as rotas continuam as mesmas. */
const groups: NavGroup[] = [
  { label: "Dashboard", icon: Home, to: "/instructor/dashboard" },
  {
    label: "Ensino",
    icon: BookOpen,
    items: [
      { to: "/instructor/missions", label: "Missões" },
      { to: "/instructor/async", label: "Atividades Assíncronas" },
      { to: "/instructor/cafe", label: "Café Central" },
      { to: "/instructor/gamification", label: "Gamificação" },
      { to: "/instructor/badges", label: "Badges" },
    ],
  },
  {
    label: "Aplicações & QA",
    icon: TestTube2,
    items: [
      { to: "/instructor/qa", label: "Módulos QA" },
      { to: "/instructor/inventory", label: "Inventário" },
      { to: "/instructor/features", label: "Funcionalidades" },
    ],
  },
  {
    label: "Avaliação",
    icon: ClipboardCheck,
    items: [
      { to: "/instructor/submissions", label: "Central de Avaliação" },
      { to: "/instructor/evaluations", label: "Matriz de Avaliação" },
      { to: "/instructor/dossier", label: "Dossiê do Aluno" },
      { to: "/instructor/final", label: "Avaliação Final" },
      { to: "/instructor/recovery", label: "Recuperação" },
      { to: "/instructor/portfolios", label: "Portfólios" },
      { to: "/instructor/reports", label: "Relatórios" },
    ],
  },
  {
    label: "Gestão",
    icon: Settings,
    items: [
      { to: "/instructor/classes", label: "Turmas" },
      { to: "/instructor/students", label: "Alunos" },
      { to: "/instructor/groups", label: "Grupos" },
    ],
  },
];

export const Route = createFileRoute("/instructor")({
  ssr: false,
  component: () => (
    <RoleGate allow="instructor">
      <AppShell
        items={items}
        groups={groups}
        homeTo="/instructor/dashboard"
        badge="Instrutor"
        profileTo="/instructor/profile"
      >
        <Outlet />
      </AppShell>
    </RoleGate>
  ),
});
