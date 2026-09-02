import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BookOpen, Coffee, FolderCheck, Home, Route as RouteIcon, Trophy } from "lucide-react";
import { AppShell, type NavGroup, type NavItem } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

/** Todas as rotas do aluno (mantidas exatamente como já existiam). */
const items: NavItem[] = [
  { to: "/student/dashboard", label: "Início" },
  { to: "/student/journey", label: "Minha Jornada" },
  { to: "/student/activities", label: "Missões da Turma" },
  { to: "/student/async", label: "Atividades Assíncronas" },
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

/** Agrupamento apenas visual do menu — as rotas continuam as mesmas. */
const groups: NavGroup[] = [
  { label: "Início", icon: Home, to: "/student/dashboard" },
  {
    label: "Jornada",
    icon: RouteIcon,
    items: [
      { to: "/student/journey", label: "Minha Jornada" },
      { to: "/student/activities", label: "Missões da Turma" },
      { to: "/student/async", label: "Atividades Assíncronas" },
      { to: "/student/missions", label: "Minhas Missões" },
    ],
  },
  {
    label: "Aprendizado",
    icon: BookOpen,
    items: [
      { to: "/student/qa", label: "Módulos QA" },
      { to: "/student/inventory", label: "Inventário da Aplicação" },
    ],
  },
  { label: "Café Central", icon: Coffee, to: "/student/cafe" },
  {
    label: "Evidências",
    icon: FolderCheck,
    items: [
      { to: "/student/records", label: "Meus Registros" },
      { to: "/student/evidences", label: "Minhas Evidências" },
      { to: "/student/portfolio", label: "Meu Portfólio" },
    ],
  },
  {
    label: "Desempenho",
    icon: Trophy,
    items: [
      { to: "/student/progress", label: "Meu Progresso" },
      { to: "/student/ranking", label: "Ranking" },
      { to: "/student/evaluation", label: "Minha Avaliação" },
    ],
  },
];

export const Route = createFileRoute("/student")({
  ssr: false,
  component: () => (
    <RoleGate allow="student">
      <AppShell
        items={items}
        groups={groups}
        homeTo="/student/dashboard"
        badge="Aluno"
        profileTo="/student/profile"
      >
        <Outlet />
      </AppShell>
    </RoleGate>
  ),
});
