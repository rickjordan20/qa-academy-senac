import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BookOpen, Coffee, FolderCheck, Home, Trophy } from "lucide-react";
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
    label: "Minha Jornada",
    icon: BookOpen,
    items: [
      { to: "/student/how-evaluated", label: "Como serei avaliado" },
      { to: "/student/journey", label: "Minha Jornada" },
      { to: "/student/qa", label: "Módulos QA" },
      { to: "/student/missions", label: "Minhas Missões" },
      { to: "/student/async", label: "Atividades Assíncronas" },
    ],
  },
  {
    label: "Projeto Café Central",
    icon: Coffee,
    items: [
      { to: "/student/activities", label: "Missões da Turma" },
      { to: "/student/cafe", label: "Café Central" },
      { to: "/student/inventory", label: "Inventário da Aplicação" },
    ],
  },
  {
    label: "Meu Trabalho",
    icon: FolderCheck,
    items: [
      { to: "/student/records", label: "Meus Registros" },
      { to: "/student/evidences", label: "Minhas Evidências" },
      { to: "/student/portfolio", label: "Meu Portfólio" },
    ],
  },
  {
    label: "Meu Desempenho",
    icon: Trophy,
    items: [
      { to: "/student/progress", label: "Meu Progresso" },
      { to: "/student/evaluation", label: "Minha Avaliação" },
      { to: "/student/ranking", label: "Ranking" },
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
