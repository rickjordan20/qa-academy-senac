import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Award, ClipboardList, FlaskConical, Home } from "lucide-react";
import { AppShell, type NavGroup, type NavItem } from "@/components/AppShell";
import { RoleGate } from "@/components/RoleGate";

/** Todas as rotas do aluno (mantidas exatamente como já existiam). */
const items: NavItem[] = [
  { to: "/student/dashboard", label: "Início" },
  { to: "/student/journey", label: "Minha Trilha UC10" },
  { to: "/student/activities", label: "Missões e Aulas" },
  { to: "/student/async", label: "Atividades Assíncronas" },
  { to: "/student/missions", label: "Minhas Entregas" },
  { to: "/student/cafe", label: "Projeto Café Central" },
  { to: "/student/inventory", label: "Inventário da Aplicação" },
  { to: "/student/qa", label: "Bancada de Testes" },
  { to: "/student/records", label: "Meus Registros" },
  { to: "/student/evidences", label: "Minhas Evidências" },
  { to: "/student/ranking", label: "Ranking de XP" },
  { to: "/student/progress", label: "Meu Progresso" },
  { to: "/student/evaluation", label: "Minha Avaliação" },
  { to: "/student/portfolio", label: "Meu Portfólio" },
  { to: "/student/profile", label: "Perfil" },
];

/** Agrupamento apenas visual do menu — as rotas continuam as mesmas. */
const groups: NavGroup[] = [
  { label: "Início", icon: Home, to: "/student/dashboard" },
  {
    label: "Missões & Entregas",
    icon: ClipboardList,
    items: [
      { to: "/student/activities", label: "Missões e Aulas" },
      { to: "/student/missions", label: "Minhas Entregas" },
      { to: "/student/async", label: "Atividades Assíncronas" },
    ],
  },
  {
    label: "Prática de QA & Projetos",
    icon: FlaskConical,
    items: [
      { to: "/student/qa", label: "Bancada de Testes" },
      { to: "/student/inventory", label: "Inventário da Aplicação" },
      { to: "/student/cafe", label: "Projeto Café Central" },
    ],
  },
  {
    label: "Avaliação & Portfólio",
    icon: Award,
    items: [
      { to: "/student/evaluation", label: "Minha Avaliação" },
      { to: "/student/how-evaluated", label: "Como serei avaliado" },
      { to: "/student/portfolio", label: "Meu Portfólio" },
      { to: "/student/journey", label: "Minha Trilha UC10" },
      { to: "/student/ranking", label: "Ranking de XP" },
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
