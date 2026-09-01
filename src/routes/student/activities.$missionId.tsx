import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { MissionPlayer } from "@/components/missions/MissionPlayer";
import { useAuth } from "@/lib/auth";
import { useMyGroups } from "@/lib/cafe";
import { useProfileNames } from "@/lib/qa";
import {
  awardMissionXp,
  blockDef,
  computeProgress,
  useBuilderMission,
  useCreateEntry,
  useDeleteEntry,
  useMyRun,
  useRunEntries,
  useSaveRun,
  useStartRun,
  type Section,
} from "@/lib/mission-builder";
import { useSubmitRun, type SubmissionRun } from "@/lib/mission-submissions";

export const Route = createFileRoute("/student/activities/$missionId")({
  head: () => ({
    meta: [
      { title: "Executar missão | QA Academy" },
      { name: "description", content: "Execute a missão da UC10, registre respostas, casos, bugs e evidências." },
      { property: "og:title", content: "Executar missão | QA Academy" },
      { property: "og:description", content: "Sua missão da UC10 na QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentMissionPage,
});

function StudentMissionPage() {
  const { missionId } = Route.useParams();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: mission } = useBuilderMission(missionId);
  const { data: groups } = useMyGroups(userId);

  const isCafe = mission?.template === "cafe";
  const [groupId, setGroupId] = useState<string | null>(null);
  useEffect(() => {
    if (isCafe && !groupId && groups?.length) setGroupId(groups[0]!.id as string);
  }, [isCafe, groupId, groups]);

  const { data: run } = useMyRun(mission ?? null, userId, groupId);
  const start = useStartRun(mission!, userId!, groupId);
  const save = useSaveRun(missionId);
  const submitRun = useSubmitRun();
  const { data: entries } = useRunEntries(run?.id ?? null);
  const createEntry = useCreateEntry(run?.id ?? "");
  const deleteEntry = useDeleteEntry(run?.id ?? "");

  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef<string | null>(null);

  useEffect(() => {
    if (run && hydrated.current !== run.id) {
      hydrated.current = run.id;
      setAnswers((run.answers ?? {}) as Record<string, Record<string, string>>);
      setChecklist(run.checklist_state ?? {});
    }
  }, [run]);

  const readOnly = mission?.status !== "published" || !run;

  const names = useProfileNames((entries ?? []).map((e) => e.author_id));
  const progress = useMemo(
    () =>
      mission
        ? computeProgress(
            mission,
            run ? { ...run, answers, checklist_state: checklist } : null,
            entries ?? [],
          )
        : 0,
    [mission, run, answers, checklist, entries],
  );

  if (!mission) return <p className="text-sm text-muted-foreground">Carregando missão...</p>;

  function persist(nextAnswers: typeof answers, nextChecklist: typeof checklist) {
    if (!run || !mission) return;
    setSaving("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await save.mutateAsync({
        runId: run.id,
        patch: {
          answers: nextAnswers,
          checklist_state: nextChecklist,
          progress: computeProgress(mission, { ...run, answers: nextAnswers, checklist_state: nextChecklist }, entries ?? []),
        },
      });
      setSaving("saved");
    }, 700);
  }

  async function addEntry(section: Section, values: Record<string, string>) {
    if (!run || !userId) return;
    const def = blockDef(section.kind);
    const titleKey = def.fields?.[0]?.key ?? "titulo";
    await createEntry.mutateAsync({
      missionId: mission!.id,
      sectionId: section.id,
      kind: section.kind,
      authorId: userId,
      groupId: run.group_id,
      title: values[titleKey] ?? "",
      status: values["status"] ?? "",
      data: values,
      link: values["url"] ?? values["link"] ?? null,
    });
    if (section.xp > 0) {
      await awardMissionXp({
        studentId: userId,
        groupId: run.group_id,
        context: isCafe ? "cafe" : "techeduca",
        action: "builder_block_submit",
        refId: mission!.id,
        note: `${mission!.title} — ${section.title}`,
      });
    }
    toast.success("Registro salvo com sua autoria.");
  }

  const header = (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <Link to="/student/activities" className="hover:underline">
        ← Todas as missões
      </Link>
      {saving === "saving" ? <span>Salvando...</span> : saving === "saved" ? <span>Salvo</span> : null}
      {mission.status === "closed" ? <span>Missão encerrada — consulta apenas.</span> : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {isCafe ? (
        <div className="max-w-sm">
          <NativeSelect value={groupId ?? ""} onChange={(v) => setGroupId(v || null)}>
            <option value="">Selecione seu grupo</option>
            {(groups ?? []).map((g) => (
              <option key={g.id as string} value={g.id as string}>
                {g.name as string}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {!run && mission.status === "published" ? (
        <Button
          disabled={(isCafe && !groupId) || !userId || start.isPending}
          onClick={async () => {
            await start.mutateAsync();
          }}
        >
          Iniciar missão
        </Button>
      ) : null}

      <MissionPlayer
        mission={mission}
        progress={progress}
        readOnly={readOnly}
        header={header}
        authorName={(id) => names.data?.[id] ?? "aluno"}
        state={{ answers, checklist, entries: entries ?? [] }}
        handlers={{
          onAnswer: (sectionId, key, value) => {
            setAnswers((a) => {
              const next = { ...a, [sectionId]: { ...(a[sectionId] ?? {}), [key]: value } };
              persist(next, checklist);
              return next;
            });
          },
          onToggle: (itemId, value) => {
            setChecklist((c) => {
              const next = { ...c, [itemId]: value };
              persist(answers, next);
              return next;
            });
          },
          onAddEntry: addEntry,
          onDeleteEntry: (id) => deleteEntry.mutate(id),
        }}
      />

      {run && mission.status === "published" ? (
        <div className="space-y-2">
          {(run as unknown as { feedback?: string }).feedback ? (
            <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
              <span className="font-semibold">Feedback do instrutor: </span>
              {(run as unknown as { feedback?: string }).feedback}
            </p>
          ) : null}
          <Button
            disabled={submitRun.isPending}
            onClick={async () => {
              const attempt = await submitRun.mutateAsync({
                run: run as unknown as SubmissionRun,
                missionId: mission.id,
                actorId: userId!,
                progress,
                answers,
                checklist: checklist,
              });
              if (userId && attempt === 1)
                await awardMissionXp({
                  studentId: userId,
                  groupId: run.group_id,
                  context: isCafe ? "cafe" : "techeduca",
                  action: "builder_mission_complete",
                  refId: mission.id,
                  note: mission.title,
                });
              toast.success("Missão entregue! A avaliação A/PA/NA é feita pelo instrutor.");
            }}
          >
            {run.submitted_at ? "Reenviar missão revisada" : "Concluir e entregar missão"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Acompanhe a situação em{" "}
            <Link to="/student/missions" className="text-accent hover:underline">
              Minhas Missões
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
