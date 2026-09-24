import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  disconnectGoogleClassroom,
  linkClassroomCourse,
  linkClassroomStudent,
  listClassroomCourses,
  syncClassroomRoster,
  unlinkClassroomCourse,
  unlinkClassroomStudent,
} from "@/lib/google-classroom.functions";
import { startGoogleClassroomAuth } from "@/lib/google-classroom.functions";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClassroomSyncDialog({
  classId,
  open,
  onOpenChange,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const sync = useServerFn(syncClassroomRoster);
  const courses = useServerFn(listClassroomCourses);
  const startAuth = useServerFn(startGoogleClassroomAuth);
  const linkCourse = useServerFn(linkClassroomCourse);
  const unlinkCourse = useServerFn(unlinkClassroomCourse);
  const linkStudent = useServerFn(linkClassroomStudent);
  const unlinkStudent = useServerFn(unlinkClassroomStudent);
  const disconnect = useServerFn(disconnectGoogleClassroom);

  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({});
  const [confirmUnlinkCourse, setConfirmUnlinkCourse] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const status = useQuery({
    queryKey: ["classroom-sync", classId],
    queryFn: () => sync({ data: { classId } }),
    enabled: open,
  });

  const connected = status.data?.connection.connected && !status.data.connection.expired;
  const link = status.data?.link ?? null;

  const coursesQuery = useQuery({
    queryKey: ["classroom-courses", classId],
    queryFn: () => courses({ data: { classId } }),
    enabled: open && !!connected && !link,
  });

  useEffect(() => {
    if (!open) setPendingChoice({});
  }, [open]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["classroom-sync", classId] });
    queryClient.invalidateQueries({ queryKey: ["classroom-courses", classId] });
  };

  const connectMutation = useMutation({
    mutationFn: async () => startAuth({ data: { classId } }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkCourseMutation = useMutation({
    mutationFn: async () => linkCourse({ data: { classId, courseId: selectedCourse } }),
    onSuccess: () => {
      toast.success("Turma do Classroom vinculada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkCourseMutation = useMutation({
    mutationFn: async () => unlinkCourse({ data: { classId } }),
    onSuccess: () => {
      toast.success("Turma desvinculada. Nenhum dado acadêmico foi alterado.");
      setSelectedCourse("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => disconnect({}),
    onSuccess: () => {
      toast.success("Conta Google desconectada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkStudentMutation = useMutation({
    mutationFn: async (vars: {
      studentId: string;
      classroomUserId: string;
      classroomEmail: string;
      classroomName: string;
    }) => linkStudent({ data: { classId, ...vars } }),
    onSuccess: () => {
      toast.success("Vínculo registrado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkStudentMutation = useMutation({
    mutationFn: async (classroomUserId: string) =>
      unlinkStudent({ data: { classId, classroomUserId } }),
    onSuccess: () => {
      toast.success("Vínculo removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availableStudents = useMemo(
    () => (status.data?.academy ?? []).filter((a) => !a.linked),
    [status.data],
  );

  const pendingRows = (status.data?.rows ?? []).filter((r) => r.status === "pending");
  const matchedRows = (status.data?.rows ?? []).filter((r) => r.status !== "pending");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Google Classroom</DialogTitle>
          <DialogDescription>
            Compara os alunos do Classroom com os alunos já matriculados nesta turma. Nenhum aluno é
            criado, removido ou alterado.
          </DialogDescription>
        </DialogHeader>

        {status.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : status.isError ? (
          <p className="py-6 text-sm text-danger">{(status.error as Error).message}</p>
        ) : !connected ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {status.data?.connection.connected
                ? "A autorização do Google expirou. Conecte a conta novamente para sincronizar."
                : "Conecte sua conta Google para ver as turmas do Classroom em que você é professor."}
            </p>
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conectar conta Google
            </Button>
          </div>
        ) : !link ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Conectado como <strong>{status.data?.connection.email}</strong>
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Selecione a turma do Classroom correspondente</p>
              {coursesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando suas turmas…
                </div>
              ) : (
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma turma do Classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {(coursesQuery.data?.courses ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.section ? ` — ${c.section}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!selectedCourse || linkCourseMutation.isPending}
                onClick={() => linkCourseMutation.mutate()}
              >
                {linkCourseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vincular turma
              </Button>
              <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
                Desconectar conta Google
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    Turma vinculada: {link.courseName}
                    {link.section ? ` — ${link.section}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Conta Google: {status.data?.connection.email} · Última sincronização:{" "}
                    {formatDateTime(link.lastSyncedAt)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => status.refetch()}
                  disabled={status.isFetching}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`}
                  />
                  Sincronizar novamente
                </Button>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <div className="text-lg font-semibold">{status.data?.classroomStudents ?? 0}</div>
                  alunos no Classroom
                </div>
                <div>
                  <div className="text-lg font-semibold">{status.data?.autoMatches ?? 0}</div>
                  correspondências automáticas
                </div>
                <div>
                  <div className="text-lg font-semibold">{status.data?.manualMatches ?? 0}</div>
                  vínculos manuais
                </div>
                <div>
                  <div className="text-lg font-semibold">{status.data?.pending ?? 0}</div>
                  pendências
                </div>
              </div>
            </div>

            {pendingRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Vínculos pendentes ({pendingRows.length})</p>
                {pendingRows.map((row) => (
                  <div
                    key={row.classroomUserId}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{row.classroomName || "Sem nome"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.classroomEmail || "sem e-mail"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={pendingChoice[row.classroomUserId] ?? ""}
                        onValueChange={(v) =>
                          setPendingChoice((prev) => ({ ...prev, [row.classroomUserId]: v }))
                        }
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Selecionar aluno da turma" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStudents.map((s) => (
                            <SelectItem key={s.studentId} value={s.studentId}>
                              {s.fullName || s.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={
                          !pendingChoice[row.classroomUserId] || linkStudentMutation.isPending
                        }
                        onClick={() =>
                          linkStudentMutation.mutate({
                            studentId: pendingChoice[row.classroomUserId]!,
                            classroomUserId: row.classroomUserId,
                            classroomEmail: row.classroomEmail,
                            classroomName: row.classroomName,
                          })
                        }
                      >
                        Vincular
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {matchedRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Vínculos registrados ({matchedRows.length})</p>
                {matchedRows.map((row) => (
                  <div
                    key={row.classroomUserId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {row.studentName || row.classroomName || "Sem nome"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Classroom: {row.classroomEmail || "sem e-mail"}
                        {row.studentEmail && row.studentEmail !== row.classroomEmail
                          ? ` · QA Academy: ${row.studentEmail}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.status === "manual" ? "secondary" : "outline"}>
                        {row.status === "manual" ? "Manual" : "Automático"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Remover vínculo"
                        onClick={() => unlinkStudentMutation.mutate(row.classroomUserId)}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(status.data?.missingInClassroom ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Alunos do QA Academy sem correspondência no Classroom (
                  {status.data?.missingInClassroom})
                </p>
                <div className="space-y-1">
                  {availableStudents.map((s) => (
                    <div
                      key={s.studentId}
                      className="rounded-lg border border-dashed border-border p-2 text-sm"
                    >
                      <div className="font-medium">{s.fullName || "Sem nome"}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setConfirmUnlinkCourse(true)}>
                Desvincular turma do Classroom
              </Button>
              <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
                Desconectar conta Google
              </Button>
            </div>
          </div>
        )}

        <AlertDialog open={confirmUnlinkCourse} onOpenChange={setConfirmUnlinkCourse}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desvincular turma do Classroom?</AlertDialogTitle>
              <AlertDialogDescription>
                Os vínculos de alunos desta turma serão apagados. Nenhum aluno, matrícula, grupo,
                entrega, avaliação ou histórico é alterado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => unlinkCourseMutation.mutate()}>
                Desvincular
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar a conta Google?</AlertDialogTitle>
              <AlertDialogDescription>
                A autorização de leitura do Classroom será removida. Os vínculos já registrados e
                todos os dados acadêmicos permanecem intactos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => disconnectMutation.mutate()}>
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
