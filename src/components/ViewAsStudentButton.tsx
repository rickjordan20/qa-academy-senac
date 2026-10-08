import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStartStudentView } from "@/lib/student-view";

/** Inicia a visualização (autorização validada no banco) e abre a área do aluno. */
export function ViewAsStudentButton({ studentId, classId }: { studentId: string; classId: string }) {
  const start = useStartStudentView();
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={start.isPending}
      onClick={() =>
        start.mutate(
          { studentId, classId },
          {
            onSuccess: () => navigate({ to: "/student/dashboard" }),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Não autorizado."),
          },
        )
      }
    >
      <Eye className="mr-1 h-4 w-4" /> Ver como aluno
    </Button>
  );
}
