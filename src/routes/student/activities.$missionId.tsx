import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMissionDateTime, missionSituation } from "@/lib/mission-schedule";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { MissionPlayer } from "@/components/missions/MissionPlayer";
import { MissionTaskBoard, SectionAssign } from "@/components/cafe/MissionTaskBoard";
import { CrossTestPanel } from "@/components/missions/CrossTestPanel";
import { useAuth } from "@/lib/auth";
import { useCreateMissionContribution, useMyGroups } from "@/lib/cafe";
import { useProfileNames } from "@/lib/qa";
import {
  awardGroupMissionXp,
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
import { useBadgeCatalog } from "@/lib/gamification";
import { groupByModule, useFeatures, useModules, type AppProject } from "@/lib/inventory";
import type { MissionPickers } from "@/components/missions/MissionPlayer";

/** contexto de retorno opcional (ex.: missão de Revisão e Auditoria) */
export type MissionSearch = { backMission?: string; backLabel?: string };

export const Route = createFileRoute("/student/activities/$missionId")({
  validateSearch: (search: Record<string, unknown>): MissionSearch => {
    const out: MissionSearch = {};
    if (typeof search["backMission"] === "string") out.backMission = search["backMission"];
    if (typeof search["backLabel"] === "string") out.backLabel = search["backLabel"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Executar missão | QA Academy" },
      {
        name: "description",
        content: "Execute a missão da UC10, registre respostas, casos, bugs e evidências.",
      },
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
  const { backMission, backLabel } = Route.useSearch();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: mission } = useBuilderMission(missionId);
  const { data: badgeCatalog } = useBadgeCatalog();
  const { data: groups } = useMyGroups(userId);

  const isCafe = mission?.template === "cafe";
  const [groupId, setGroupId] = useState<string | null>(null);
  useEffect(() => {
    if (isCafe && !groupId && groups?.length) setGroupId(groups[0]!.id as string);
  }, [isCafe, groupId, groups]);

  const group = (groups ?? []).find((g) => g.id === groupId) ?? null;
  const myGroupIds = (groups ?? []).map((g) => g.id as string);
  const myClassIds = Array.from(new Set((groups ?? []).map((g) => g.class_id as string)));

  const { data: run } = useMyRun(mission ?? null, userId, groupId);
  const start = useStartRun(mission!, userId!, groupId);
  const save = useSaveRun(missionId);
  const submitRun = useSubmitRun();
  const { data: entries } = useRunEntries(run?.id ?? null);
  const createEntry = useCreateEntry(run?.id ?? "");
  const createContribution = useCreateMissionContribution(
    run?.id ?? null,
    missionId,
    groupId,
    userId,
  );
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

  /* Inventário real da missão: TechEduca (base) ou apenas o inventário do grupo no Café Central */
  const project: AppProject = isCafe ? "cafe_central" : "techeduca";
  const { data: invFeatures } = useFeatures(project, isCafe ? groupId : null);
  const { data: invModules } = useModules(project, isCafe ? groupId : null);

  const pickers: MissionPickers = useMemo(() => {
    const allowed = mission?.feature_ids ?? [];
    const feats = (invFeatures ?? []).filter((f) => (allowed.length ? allowed.includes(f.id) : true));
    const { tree, orphans: looseFeats } = groupByModule(invModules ?? [], feats);
    const features = tree.flatMap((node) =>
      node.features.map((f) => ({ value: f.id, label: f.name, group: node.module.name })),
    );
    const orphans = looseFeats.map((f) => ({ value: f.id, label: f.name, group: "Sem módulo" }));

    const caseSections = new Map((mission?.sections ?? []).map((sec) => [sec.id, sec]));
    const cases = (entries ?? [])
      .filter((e) => e.kind === "test_case")
      .filter((e) => {
        if (!isCafe) return e.author_id === userId;
        const sec = caseSections.get(e.section_id);
        return sec?.scope === "individual" ? e.author_id === userId : true;
      })
      .map((e, i) => {
        const featureLabel =
          [...features, ...orphans].find((f) => f.value === e.feature_id)?.label ??
          (e.data?.["funcionalidade"] ?? "");
        return {
          value: e.id,
          label: `CT-${String(i + 1).padStart(3, "0")} — ${e.title || "(sem título)"}`,
          expected: e.data?.["esperado"] ?? "",
          featureId: e.feature_id,
          featureLabel,
        };
      });

    return { features: [...features, ...orphans], cases };
  }, [invFeatures, invModules, mission, entries, isCafe, userId]);
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
          progress: computeProgress(
            mission,
            { ...run, answers: nextAnswers, checklist_state: nextChecklist },
            entries ?? [],
          ),
        },
      });
      setSaving("saved");
    }, 700);
  }

  async function addEntry(section: Section, values: Record<string, string>) {
    if (!run || !userId) return;
    const def = blockDef(section.kind);
    const titleKey = def.fields?.[0]?.key ?? "titulo";
    const featureId = values["feature_id"] || null;
    const parentId = values["case_id"] || null;
    const data = { ...values };
    delete data["feature_id"];
    delete data["case_id"];
    const entryId = await createEntry.mutateAsync({
      missionId: mission!.id,
      sectionId: section.id,
      kind: section.kind,
      authorId: userId,
      groupId: run.group_id,
      title: values[titleKey] ?? "",
      status: values["status"] ?? "",
      data,
      featureId,
      parentId,
      link: values["url"] ?? values["link"] ?? null,
    });
    const individual = !isCafe || section.scope === "individual";
    if (section.xp > 0) {
      await awardMissionXp({
        studentId: userId,
        groupId: run.group_id,
        context: isCafe ? "cafe" : "techeduca",
        action: "builder_block_submit",
        refId: entryId ?? mission!.id,
        note: `${mission!.title} — ${section.title}`,
      });
    }
    if (isCafe && run.group_id && !individual) {
      // bloco coletivo: XP de grupo pela missão em geral (uma vez por execução)
      await awardGroupMissionXp({
        groupId: run.group_id,
        action: "cafe_collaboration",
        refId: run.id,
        note: `${mission!.title} — colaboração do grupo`,
      });
    }
    if (isCafe && groupId) {
      // rastreabilidade individual: aparece em "Minhas contribuições"
      try {
        await createContribution.mutateAsync({
          task_id: null,
          section_id: section.id,
          scope: individual ? "individual" : "group",
          kind: section.kind === "evidence" ? "evidencia" : "execucao",
          title: values[titleKey] ?? section.title,
          description:
            values["descricao"] ?? values["description"] ?? `Registro no bloco ${section.title}.`,
          link: values["url"] ?? values["link"] ?? null,
          reflection: "",
        });
      } catch (err) {
        console.error("[café] falha ao espelhar contribuição do bloco:", err);
      }
    }
    toast.success(
      individual
        ? "Registro individual salvo com sua autoria."
        : "Registro do grupo salvo com sua autoria.",
    );
  }

  const situation = missionSituation(mission, (run ?? null) as never);
  const relatedBadge = (badgeCatalog ?? []).find((b) => b.code === mission.badge_code) ?? null;

  const isAuditMission = /auditoria|revis/i.test(`${mission.title} ${mission.code ?? ""}`);
  const qaScopeValue = isCafe && groupId ? `cafe:${groupId}` : "techeduca";

  const header = (
    <div className="mt-4 space-y-2 text-xs text-muted-foreground">
      {backMission && backMission !== mission.id ? (
        <Link
          to="/student/activities/$missionId"
          params={{ missionId: backMission }}
          className="inline-block rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:underline"
        >
          ← Voltar para {backLabel ?? "Revisão e Auditoria"}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/student/activities" className="hover:underline">
          ← Todas as missões
        </Link>
        {isAuditMission ? (
          <Link
            to="/student/qa"
            search={{ scope: qaScopeValue, backMission: mission.id, backLabel: mission.title }}
            className="font-semibold text-accent hover:underline"
          >
            Ver todos os testes do grupo
          </Link>
        ) : run ? (
          <Link
            to="/student/missions/$runId"
            params={{ runId: run.id }}
            className="hover:underline"
          >
            Ver registros desta missão
          </Link>
        ) : null}
        {saving === "saving" ? (
          <span>Salvando...</span>
        ) : saving === "saved" ? (
          <span>Salvo</span>
        ) : null}
        {mission.status === "closed" ? <span>Missão encerrada — consulta apenas.</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span>Abertura: {mission.opens_at ? fmtMissionDateTime(mission.opens_at, "opens") : "livre"}</span>
        <span>Prazo: {mission.due_at ? fmtMissionDateTime(mission.due_at, "due") : "sem prazo"}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${situation.tone}`}>Status: {situation.label}</span>
      </div>
      {relatedBadge ? (
        <div className="rounded-md border border-border bg-muted/40 p-2">
          <p className="font-semibold text-foreground">🏅 Badge relacionado: {relatedBadge.name}</p>
          {relatedBadge.criteria ? <p>Critério: {relatedBadge.criteria}</p> : null}
          <p className="mt-1">
            O badge é conquistado ao atingir o critério — concluir esta missão não o concede automaticamente.
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
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

      {isCafe && run && group ? (
        <MissionTaskBoard
          missionId={mission.id}
          runId={run.id}
          group={group}
          userId={userId}
          sections={(mission.sections ?? []).filter((s) => s.visible)}
        />
      ) : null}

      <MissionPlayer
        mission={mission}
        progress={progress}
        readOnly={readOnly}
        header={header}
        authorName={(id) => names.data?.[id] ?? "aluno"}
        sectionExtra={(section) => (
          <>
            {isCafe && run && group ? (
              <SectionAssign
                section={section}
                runId={run.id}
                missionId={mission.id}
                group={group}
                userId={userId}
              />
            ) : null}
            {section.kind === "cross_test" ? (
              <CrossTestPanel
                missionId={mission.id}
                sectionId={section.id}
                userId={userId}
                classIds={myClassIds}
                myGroupIds={myGroupIds}
              />
            ) : null}
          </>
        )}
        entryFilter={
          isCafe
            ? (section, entry) =>
                section.scope === "individual" ? entry.author_id === userId : true
            : undefined
        }
        pickers={pickers}
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
              if (isCafe && run.group_id)
                await awardGroupMissionXp({
                  groupId: run.group_id,
                  action: "cafe_mission_delivered",
                  refId: run.id,
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
