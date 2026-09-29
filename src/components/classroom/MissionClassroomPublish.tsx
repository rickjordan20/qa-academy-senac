import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/missions/DynamicFields";
import {
  listMissionClassroomTargets,
  publishMissionToClassroom,
  startGoogleClassroomAuth,
  updateMissionInClassroom,
} from "@/lib/google-classroom.functions";

export function MissionClassroomPublish({
  missionId,
  missionPublished,
}: {
  missionId: string;
  missionPublished: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const list = useServerFn(listMissionClassroomTargets);
  const publish = useServerFn(publishMissionToClassroom);
  const update = useServerFn(updateMissionInClassroom);
  const startAuth = useServerFn(startGoogleClassroomAuth);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("gclassroom");
    if (!flag) return;
    if (flag === "connected") toast.success("Conta Google reconectada.");
    else toast.error("Não foi possível reconectar a conta Google.");
    setOpen(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const q = useQuery({
    queryKey: ["classroom-mission-targets", missionId],
    enabled: open,
    queryFn: () => list({ data: { missionId } }),
  });
  const targets = q.data?.targets ?? [];
  const selected = targets.find((t) => t.classId === classId) ?? null;
  const conn = q.data?.connection;
  const needsReconnect = !!conn && (!conn.connected || conn.expired);

  useEffect(() => {
    if (!classId && targets.length === 1) setClassId(targets[0]!.classId);
  }, [targets, classId]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["classroom-mission-targets", missionId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }

  async function reconnect() {
    if (!classId) return toast.error("Selecione a turma de destino.");
    setBusy(true);
    try {
      const { url } = await startAuth({ data: { classId, returnPath: window.location.pathname } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar a conexão.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Google Classroom
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publicar no Google Classroom</DialogTitle>
            <DialogDescription>
              Envia título, objetivo, prazo e o link da missão. XP e avaliação continuam somente no QA Academy.
            </DialogDescription>
          </DialogHeader>

          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : q.error ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma turma desta missão está vinculada ao Google Classroom. Vincule a turma na tela da turma.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Turma de destino</label>
                <NativeSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">Selecione a turma...</option>
                  {targets.map((t) => (
                    <option key={t.classId} value={t.classId}>
                      {t.className} → {t.courseName}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {!missionPublished ? (
                <p className="text-sm text-muted-foreground">
                  Publique a missão no QA Academy antes de enviá-la ao Classroom.
                </p>
              ) : null}

              {needsReconnect ? (
                <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <p>
                    Para publicar atividades, o Google precisa de uma nova autorização. Reconecte sua conta Google
                    e aceite a permissão de criar atividades.
                  </p>
                  <Button size="sm" onClick={reconnect} disabled={busy || !classId}>
                    Reconectar conta Google
                  </Button>
                </div>
              ) : null}

              {selected ? (
                selected.publication ? (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <p className="text-sm font-medium">Publicado no Google Classroom</p>
                    <p className="text-xs text-muted-foreground">
                      Última atualização:{" "}
                      {new Date(selected.publication.lastPublishedAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selected.publication.alternateLink ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={selected.publication.alternateLink} target="_blank" rel="noreferrer">
                            Abrir no Classroom
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        disabled={busy || needsReconnect || !missionPublished}
                        onClick={() =>
                          run(
                            () => update({ data: { missionId, classId: selected.classId } }),
                            "Atividade atualizada no Google Classroom.",
                          )
                        }
                      >
                        Atualizar no Google Classroom
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se o Google recusar por falta de permissão, use "Reconectar conta Google".
                    </p>
                  </div>
                ) : (
                  <Button
                    disabled={busy || needsReconnect || !missionPublished}
                    onClick={() =>
                      run(
                        () => publish({ data: { missionId, classId: selected.classId } }),
                        "Missão publicada no Google Classroom.",
                      )
                    }
                  >
                    Publicar na turma {selected.className}
                  </Button>
                )
              ) : null}

              {selected && !needsReconnect ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={reconnect}
                  disabled={busy}
                >
                  Reconectar conta Google
                </button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
