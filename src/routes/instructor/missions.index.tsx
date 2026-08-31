import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { useAuth } from "@/lib/auth";
import {
  PRESETS,
  STATUS_LABEL,
  TEMPLATE_LABEL,
  newSection,
  useBuilderMissions,
  useCreateMission,
  useDeleteMission,
  useDuplicateMission,
  useMissionParticipation,
  useUpdateMission,
  type BuilderMission,
  type MissionTemplate,
} from "@/lib/mission-builder";

export const Route = createFileRoute("/instructor/missions/")({
  head: () => ({
    meta: [
      { title: "Missões | QA Academy" },
      {
        name: "description",
        content: "Construtor universal de missões da UC10: crie, publique e acompanhe atividades sem alterar código.",
      },
      { property: "og:title", content: "Missões | QA Academy" },
      {
        property: "og:description",
        content: "Crie missões TechEduca e Café Central diretamente pela plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionsListPage,
});

function MissionsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"missions" | "library">("missions");
  const { data: missions } = useBuilderMissions({ library: tab === "library" });
  const { data: participation } = useMissionParticipation();
  const create = useCreateMission(user?.id ?? null);
  const duplicate = useDuplicateMission(user?.id ?? null);
  const update = useUpdateMission();
  const remove = useDeleteMission();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ template: "techeduca" as MissionTemplate, title: "", lesson: "", preset: "" });
  const [filters, setFilters] = useState({ template: "", status: "", q: "" });

  const list = useMemo(() => {
    return (missions ?? []).filter((m) => {
      if (filters.template && m.template !== filters.template) return false;
      if (filters.status && m.status !== filters.status) return false;
      if (filters.q && !`${m.lesson_number ?? ""} ${m.title}`.toLowerCase().includes(filters.q.toLowerCase()))
        return false;
      return true;
    });
  }, [missions, filters]);

  async function handleCreate() {
    if (!form.title.trim()) return toast.error("Informe o título da missão.");
    const preset = PRESETS.find((p) => p.id === form.preset);
    const sections = (preset?.blocks ?? []).map((k) => newSection(k, form.template));
    const created = await create.mutateAsync({
      title: form.title.trim(),
      template: form.template,
      lesson_number: form.lesson ? Number(form.lesson) : null,
      sections,
    });
    setCreating(false);
    setForm({ template: "techeduca", title: "", lesson: "", preset: "" });
    navigate({ to: "/instructor/missions/$missionId", params: { missionId: created.id } });
  }

  async function setStatus(m: BuilderMission, status: string) {
    await update.mutateAsync({ id: m.id, patch: { status: status as BuilderMission["status"] } });
    toast.success(`Missão ${STATUS_LABEL[status]?.toLowerCase()}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Missões</h1>
          <p className="text-sm text-muted-foreground">
            Construtor universal: monte qualquer atividade da UC10 por blocos, sem alterar código.
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>+ Nova missão</Button>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setTab("missions")}
          className={`rounded-md px-3 py-1.5 ${tab === "missions" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
        >
          Missões
        </button>
        <button
          onClick={() => setTab("library")}
          className={`rounded-md px-3 py-1.5 ${tab === "library" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
        >
          Biblioteca de modelos
        </button>
      </div>

      {creating ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm font-semibold">Qual tipo de missão deseja criar?</p>
            <div className="flex flex-wrap gap-2">
              {(["techeduca", "cafe", "custom"] as MissionTemplate[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, template: t }))}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    form.template === t ? "border-accent bg-secondary" : "border-border"
                  }`}
                >
                  {TEMPLATE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Aula</Label>
                <Input
                  type="number"
                  value={form.lesson}
                  onChange={(e) => setForm((f) => ({ ...f, lesson: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Título</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <Label className="text-xs">Preset de blocos (opcional)</Label>
                <NativeSelect value={form.preset} onChange={(v) => setForm((f) => ({ ...f, preset: v }))}>
                  <option value="">Começar em branco</option>
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={create.isPending}>
              Criar rascunho
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <NativeSelect value={filters.template} onChange={(v) => setFilters((f) => ({ ...f, template: v }))}>
          <option value="">Todos os projetos</option>
          <option value="techeduca">TechEduca</option>
          <option value="cafe">Café Central</option>
          <option value="custom">Personalizada</option>
        </NativeSelect>
        <NativeSelect value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <Input
          placeholder="Buscar por aula ou título"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
      </div>

      <div className="space-y-3">
        {list.map((m) => {
          const part = participation?.[m.id];
          return (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-56">
                  <p className="font-semibold">
                    {m.lesson_number ? `Aula ${m.lesson_number} · ` : ""}
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {TEMPLATE_LABEL[m.template]} · {STATUS_LABEL[m.status]} · {m.sections.length} blocos ·{" "}
                    {m.base_xp} XP · {m.indicator_codes.join(", ") || "sem indicadores"}
                    {part ? ` · ${part.runs} execuções (${part.done} concluídas)` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/instructor/missions/$missionId" params={{ missionId: m.id }}>
                      Editar
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await duplicate.mutateAsync({ mission: m });
                      toast.success("Missão duplicada como rascunho (sem respostas).");
                    }}
                  >
                    Duplicar
                  </Button>
                  {!m.is_library_template ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await duplicate.mutateAsync({ mission: m, asLibrary: true, name: m.title });
                        toast.success("Salvo na biblioteca de modelos.");
                      }}
                    >
                      Salvar como modelo
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const created = await duplicate.mutateAsync({ mission: m, name: m.title });
                        navigate({ to: "/instructor/missions/$missionId", params: { missionId: created.id } });
                      }}
                    >
                      Usar modelo
                    </Button>
                  )}
                  {!m.is_library_template && m.status === "draft" ? (
                    <Button size="sm" onClick={() => setStatus(m, "published")}>
                      Publicar
                    </Button>
                  ) : null}
                  {m.status === "published" ? (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(m, "closed")}>
                      Encerrar
                    </Button>
                  ) : null}
                  {m.status === "closed" ? (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(m, "published")}>
                      Reabrir
                    </Button>
                  ) : null}
                  {m.status !== "archived" && !m.is_library_template ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(m, "archived")}>
                      Arquivar
                    </Button>
                  ) : null}
                  {m.status === "draft" || m.is_library_template ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Excluir definitivamente?")) return;
                        await remove.mutateAsync(m.id);
                      }}
                    >
                      Excluir
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma missão encontrada com esses filtros.</p>
        ) : null}
      </div>
    </div>
  );
}
