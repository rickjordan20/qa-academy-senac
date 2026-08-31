import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { SectionEditor } from "@/components/missions/SectionEditor";
import { MissionPlayer } from "@/components/missions/MissionPlayer";
import { useAuth } from "@/lib/auth";
import {
  BLOCK_CATALOG,
  PRESETS,
  STATUS_LABEL,
  TEMPLATE_LABEL,
  blockDef,
  newSection,
  uid,
  useBuilderMission,
  useMissionAssignments,
  useMissionRunsForInstructor,
  useSetAssignments,
  useUpdateMission,
  type BuilderMission,
  type Section,
} from "@/lib/mission-builder";
import { useIndicators } from "@/lib/uc10";
import { useFeatures, type AppProject } from "@/lib/inventory";

export const Route = createFileRoute("/instructor/missions/$missionId")({
  head: () => ({
    meta: [
      { title: "Editar missão | QA Academy" },
      { name: "description", content: "Monte a missão por blocos, defina XP, indicadores e publique para a turma." },
      { property: "og:title", content: "Editar missão | QA Academy" },
      { property: "og:description", content: "Construtor de missões da UC10 na QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionBuilderPage,
});

function useInstructorClasses(userId: string | null) {
  return useQuery({
    queryKey: ["builder-classes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").eq("instructor_id", userId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

function MissionBuilderPage() {
  const { missionId } = Route.useParams();
  const { user } = useAuth();
  const { data: mission } = useBuilderMission(missionId);
  const { data: classes } = useInstructorClasses(user?.id ?? null);
  const { data: assignments } = useMissionAssignments(missionId);
  const { data: runs } = useMissionRunsForInstructor(missionId);
  const { data: indicators } = useIndicators();
  const update = useUpdateMission();
  const setAssignments = useSetAssignments(missionId);

  const [draft, setDraft] = useState<BuilderMission | null>(null);
  const [preview, setPreview] = useState(false);
  const [classIds, setClassIds] = useState<string[]>([]);

  useEffect(() => {
    if (mission && !draft) setDraft(mission);
  }, [mission, draft]);
  useEffect(() => {
    if (assignments) setClassIds(assignments.map((a) => a.class_id));
  }, [assignments]);

  const project: AppProject = draft?.template === "cafe" ? "cafe_central" : "techeduca";
  const { data: features } = useFeatures(project, null);

  const hasAnswers = (runs?.length ?? 0) > 0;

  const sections = draft?.sections ?? [];
  const catalog = useMemo(
    () => BLOCK_CATALOG.filter((b) => (draft?.template === "cafe" ? true : !b.cafeOnly)),
    [draft?.template],
  );

  if (!draft) return <p className="text-sm text-muted-foreground">Carregando missão...</p>;

  function patch(p: Partial<BuilderMission>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }
  function patchSection(id: string, p: Partial<Section>) {
    setDraft((d) => (d ? { ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) } : d));
  }
  function moveSection(id: string, dir: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const arr = [...d.sections];
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...d, sections: arr };
    });
  }

  async function save() {
    if (!draft) return;
    await update.mutateAsync({
      id: draft.id,
      patch: {
        lesson_number: draft.lesson_number,
        title: draft.title,
        subtitle: draft.subtitle,
        description: draft.description,
        project: draft.project,
        template: draft.template,
        modality: draft.modality,
        workload: draft.workload,
        objective: draft.objective,
        opens_at: draft.opens_at,
        due_at: draft.due_at,
        base_xp: draft.base_xp,
        badge_code: draft.badge_code,
        indicator_codes: draft.indicator_codes,
        feature_ids: draft.feature_ids,
        sections: draft.sections,
        library_name: draft.library_name,
      },
    });
    await setAssignments.mutateAsync(classIds);
    toast.success("Missão salva.");
  }

  async function changeStatus(status: BuilderMission["status"]) {
    await save();
    await update.mutateAsync({ id: draft!.id, patch: { status } });
    patch({ status });
    toast.success(`Missão ${STATUS_LABEL[status]?.toLowerCase()}.`);
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            👁 Pré-visualização como {draft.template === "cafe" ? "integrante do grupo" : "aluno"} — nenhum progresso é
            registrado.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setPreview(false)}>
            Voltar ao construtor
          </Button>
        </div>
        <MissionPlayer
          mission={draft}
          progress={0}
          state={{ answers: {}, checklist: {}, entries: [] }}
          handlers={{ onAnswer: () => {}, onToggle: () => {}, onAddEntry: () => {}, onDeleteEntry: () => {} }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/instructor/missions" className="text-xs text-muted-foreground hover:underline">
            ← Voltar para missões
          </Link>
          <h1 className="text-2xl font-bold">{draft.title}</h1>
          <p className="text-sm text-muted-foreground">
            {TEMPLATE_LABEL[draft.template]} · {STATUS_LABEL[draft.status]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreview(true)}>
            👁 Visualizar como aluno
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            Salvar
          </Button>
          {draft.status === "draft" ? <Button onClick={() => changeStatus("published")}>Publicar</Button> : null}
          {draft.status === "published" ? (
            <Button variant="secondary" onClick={() => changeStatus("closed")}>
              Encerrar
            </Button>
          ) : null}
          {draft.status === "closed" ? (
            <Button variant="secondary" onClick={() => changeStatus("published")}>
              Reabrir
            </Button>
          ) : null}
        </div>
      </div>

      {hasAnswers ? (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
          Esta missão já possui registros de alunos ({runs?.length}). Alterações estruturais podem afetar dados
          existentes — respostas já enviadas não são apagadas.
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuração geral</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Aula</Label>
            <Input
              type="number"
              value={draft.lesson_number ?? ""}
              onChange={(e) => patch({ lesson_number: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Título</Label>
            <Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">Subtítulo</Label>
            <Input value={draft.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">Objetivo</Label>
            <Textarea rows={2} value={draft.objective} onChange={(e) => patch({ objective: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">Descrição interna</Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Template</Label>
            <NativeSelect
              value={draft.template}
              onChange={(v) =>
                patch({
                  template: v as BuilderMission["template"],
                  project: v === "cafe" ? "cafe_central" : "techeduca",
                  modality: v === "cafe" ? "grupo" : "individual",
                })
              }
            >
              <option value="techeduca">🎓 TechEduca — individual guiada</option>
              <option value="cafe">🚀 Café Central — autônoma em grupo</option>
              <option value="custom">🧩 Personalizada</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Carga horária</Label>
            <Input value={draft.workload} onChange={(e) => patch({ workload: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">XP base</Label>
            <Input
              type="number"
              value={draft.base_xp}
              onChange={(e) => patch({ base_xp: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Abertura</Label>
            <Input
              type="date"
              value={draft.opens_at?.slice(0, 10) ?? ""}
              onChange={(e) => patch({ opens_at: e.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prazo</Label>
            <Input
              type="date"
              value={draft.due_at?.slice(0, 10) ?? ""}
              onChange={(e) => patch({ due_at: e.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Badge (opcional)</Label>
            <Input value={draft.badge_code ?? ""} onChange={(e) => patch({ badge_code: e.target.value || null })} />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <Label className="text-xs">Indicadores da UC10</Label>
            <div className="flex flex-wrap gap-2">
              {(indicators ?? []).map((i) => {
                const code = (i as { code: string }).code;
                const on = draft.indicator_codes.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() =>
                      patch({
                        indicator_codes: on
                          ? draft.indicator_codes.filter((c) => c !== code)
                          : [...draft.indicator_codes, code],
                      })
                    }
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sm:col-span-3 space-y-2">
            <Label className="text-xs">Funcionalidades do inventário (por Módulo/Tela)</Label>
            {[
              ...groupByModule(modules ?? [], features ?? []).tree.map((g) => ({
                key: g.module.id,
                name: g.module.name,
                items: g.features,
              })),
              {
                key: "__none",
                name: "Sem Módulo/Tela",
                items: groupByModule(modules ?? [], features ?? []).orphans,
              },
            ]
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.key} className="space-y-1">
                  <p className="text-xs text-muted-foreground">📄 {g.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((f) => {
                      const on = draft.feature_ids.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() =>
                            patch({
                              feature_ids: on
                                ? draft.feature_ids.filter((x) => x !== f.id)
                                : [...draft.feature_ids, f.id],
                            })
                          }
                          className={`rounded-md px-2 py-1 text-xs ${
                            on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {f.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>


          <div className="sm:col-span-3 space-y-1">
            <Label className="text-xs">Turmas com acesso (vazio = todas as turmas)</Label>
            <div className="flex flex-wrap gap-3">
              {(classes ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={classIds.includes(c.id)}
                    onCheckedChange={(v) =>
                      setClassIds((ids) => (v ? [...ids, c.id] : ids.filter((x) => x !== c.id)))
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Blocos da missão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    patch({
                      sections: [...sections, ...p.blocks.map((k) => newSection(k, draft.template))],
                    })
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">+ Adicionar bloco</Label>
            <div className="flex flex-wrap gap-2">
              {catalog.map((b) => (
                <Button
                  key={b.kind}
                  size="sm"
                  variant="outline"
                  onClick={() => patch({ sections: [...sections, newSection(b.kind, draft.template)] })}
                >
                  {b.icon} {b.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sections.map((s, i) => (
          <SectionEditor
            key={s.id}
            section={s}
            index={i}
            total={sections.length}
            onChange={(p) => patchSection(s.id, p)}
            onMove={(dir) => moveSection(s.id, dir)}
            onDuplicate={() =>
              patch({
                sections: [
                  ...sections.slice(0, i + 1),
                  { ...s, id: uid(), title: `${s.title} (cópia)` },
                  ...sections.slice(i + 1),
                ],
              })
            }
            onRemove={() => patch({ sections: sections.filter((x) => x.id !== s.id) })}
          />
        ))}
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Adicione blocos usando um preset ou o catálogo acima. Cada bloco vira uma etapa da missão para o aluno.
          </p>
        ) : null}
      </div>

      {sections.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Blocos: {sections.map((s) => blockDef(s.kind).label).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
