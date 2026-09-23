import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BarChart3, BookOpen, ClipboardCheck, FlaskConical, Home, Users } from "lucide-react";
import { AppShell, type NavGroup, type NavItem } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

/** Todas as rotas do instrutor (mantidas exatamente como já existiam). */
const items: NavItem[] = [
  { to: "/instructor/dashboard", label: "Início" },
  { to: "/instructor/classes", label: "Turmas" },
  { to: "/instructor/students", label: "Alunos" },
  { to: "/instructor/groups", label: "Grupos & Equipes" },
  { to: "/instructor/cafe", label: "Painel do Café Central" },
  { to: "/instructor/missions", label: "Gestão de Missões" },
  { to: "/instructor/async", label: "Atividades Assíncronas" },
  { to: "/instructor/submissions", label: "Entregas dos Alunos" },
  { to: "/instructor/features", label: "Funcionalidades do Sistema" },
  { to: "/instructor/inventory", label: "Inventário da Aplicação" },
  { to: "/instructor/qa", label: "Central de QA" },
  { to: "/instructor/gamification", label: "Gamificação & XP" },
  { to: "/instructor/badges", label: "Catálogo de Badges" },
  { to: "/instructor/evaluations", label: "Matriz de Indicadores" },
  { to: "/instructor/dossier", label: "Dossiê do Aluno" },
  { to: "/instructor/final", label: "Avaliação Final" },
  { to: "/instructor/recovery", label: "Recuperação" },
  { to: "/instructor/portfolios", label: "Portfólios da Turma" },
  { to: "/instructor/reports", label: "Relatórios Pedagógicos" },
  { to: "/instructor/reports/deliveries", label: "Entregas por Missão" },
  { to: "/instructor/reports/closure", label: "Fechamento da UC10" },

  { to: "/instructor/profile", label: "Perfil" },
];

/** Agrupamento apenas visual do menu — as rotas continuam as mesmas. */
const groups: NavGroup[] = [
  { label: "Início", icon: Home, to: "/instructor/dashboard" },
  {
    label: "Gestão da Turma",
    icon: Users,
    items: [
      { to: "/instructor/classes", label: "Turmas" },
      { to: "/instructor/students", label: "Alunos" },
      { to: "/instructor/groups", label: "Grupos & Equipes" },
    ],
  },
  {
    label: "Aulas & Missões",
    icon: BookOpen,
    items: [
      { to: "/instructor/missions", label: "Gestão de Missões" },
      { to: "/instructor/async", label: "Atividades Assíncronas" },
    ],
  },
  {
    label: "Prática de QA & Café Central",
    icon: FlaskConical,
    items: [
      { to: "/instructor/qa", label: "Central de QA" },
      { to: "/instructor/inventory", label: "Inventário da Aplicação" },
      { to: "/instructor/features", label: "Funcionalidades do Sistema" },
      { to: "/instructor/cafe", label: "Painel do Café Central" },
    ],
  },
  {
    label: "Avaliação & Fechamento",
    icon: ClipboardCheck,
    items: [
      { to: "/instructor/submissions", label: "Entregas dos Alunos" },
      { to: "/instructor/evaluations", label: "Matriz de Indicadores" },
      { to: "/instructor/dossier", label: "Dossiê do Aluno" },
      { to: "/instructor/final", label: "Avaliação Final" },
      { to: "/instructor/recovery", label: "Recuperação" },
      { to: "/instructor/reports/closure", label: "Fechamento da UC10" },
    ],
  },
  {
    label: "Relatórios & Engajamento",
    icon: BarChart3,
    items: [
      { to: "/instructor/reports", label: "Relatórios Pedagógicos" },
      { to: "/instructor/portfolios", label: "Portfólios da Turma" },
      { to: "/instructor/gamification", label: "Gamificação & XP" },
      { to: "/instructor/badges", label: "Catálogo de Badges" },
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
