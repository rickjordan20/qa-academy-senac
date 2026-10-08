import { useEffect, type ReactNode } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  endStudentView,
  StudentViewProvider,
  useStudentViewSession,
  type StudentView,
} from "@/lib/student-view";
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
    <RoleGate allow="student" allowInstructorView>
      <StudentArea>
      <AppShell
        items={items}
        groups={groups}
        homeTo="/student/dashboard"
        badge="Aluno"
        profileTo="/student/profile"
      >
        <Outlet />
      </AppShell>
      </StudentArea>
    </RoleGate>
  ),
});

/** Aluno: passa direto. Instrutor: só com sessão de visualização válida no banco. */
function StudentArea({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const isInstructor = role === "instructor";
  const { data: view, isPending, isError } = useStudentViewSession(isInstructor);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isInstructor || isPending) return;
    if (isError || !view) {
      toast.error("Visualização como aluno inativa ou não autorizada.");
      navigate({ to: "/instructor/students", replace: true });
    }
  }, [isInstructor, isPending, isError, view, navigate]);

  if (!isInstructor) return <>{children}</>;
  if (isPending || !view) {
    return <p className="p-6 text-sm text-muted-foreground">Validando visualização...</p>;
  }
  return (
    <StudentViewProvider key={`${view.student_id}:${view.class_id}`} view={view}>
      <StudentViewBanner view={view} />
      {children}
    </StudentViewProvider>
  );
}

function StudentViewBanner({ view }: { view: StudentView }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function leave(to: "/instructor/dashboard" | "/instructor/students") {
    await endStudentView(qc);
    navigate({ to, replace: true });
  }
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-2 border-accent bg-accent/15 px-4 py-2 text-sm"
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-accent" />
        <span>
          Visualizando como <strong>{view.student_name}</strong>
          {view.class_name ? <> · Turma {view.class_name}</> : null}
          <span className="ml-2 rounded bg-accent/25 px-2 py-0.5 text-xs font-semibold">Somente leitura</span>
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => void leave("/instructor/students")}>
          Trocar de aluno
        </Button>
        <Button size="sm" onClick={() => void leave("/instructor/dashboard")}>
          Voltar ao painel do instrutor
        </Button>
      </div>
    </div>
  );
}
