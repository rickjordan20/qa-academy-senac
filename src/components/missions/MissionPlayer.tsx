import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EvidenceGuide } from "@/components/EvidenceGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  FieldInput,
  NativeSelect,
  SearchableSelect,
  type PickerOption,
} from "@/components/missions/DynamicFields";
import { RichText } from "@/components/missions/RichText";
import {
  blockDef,
  type BuilderMission,
  type ChecklistItemDef,
  type FieldDef,
  type MaterialItem,
  type MissionEntry,
  type QuestionDef,
  type Section,
} from "@/lib/mission-builder";

export type PlayerState = {
  answers: Record<string, Record<string, string>>;
  checklist: Record<string, boolean>;
  entries: MissionEntry[];
};

export type CaseOption = PickerOption & {
  expected?: string | undefined;
  featureId?: string | null | undefined;
  featureLabel?: string | undefined;
};

/** Opções reais do inventário e dos casos de teste da missão (rastreabilidade por ID). */
export type MissionPickers = {
  features: PickerOption[];
  cases: CaseOption[];
  /** Integrantes do grupo da entrega (Café Central). */
  members?: PickerOption[] | undefined;
  /** Evidências já registradas nesta missão. */
  evidences?: PickerOption[] | undefined;
  /** Bugs já registrados nesta missão. */
  bugs?: PickerOption[] | undefined;
};

export type PlayerHandlers = {
  onAnswer: (sectionId: string, key: string, value: string) => void;
  onToggle: (itemId: string, value: boolean) => void;
  onAddEntry: (section: Section, values: Record<string, string>) => Promise<void> | void;
  onUpdateEntry?: (section: Section, entry: MissionEntry, values: Record<string, string>) => Promise<void> | void;
  onDeleteEntry: (id: string) => void;
  /** Autorização de edição/exclusão do registro (autor ou integrante do grupo). */
  canEditEntry?: (entry: MissionEntry) => boolean;
};

function EntryForm({
  section,
  fields,
  disabled,
  pickers,
  onSubmit,
  initial,
  onCancel,
}: {
  section: Section;
  fields: FieldDef[];
  disabled: boolean;
  pickers?: MissionPickers | undefined;
  onSubmit: (values: Record<string, string>) => void;
  /** Modo edição: valores atuais do registro. */
  initial?: Record<string, string> | undefined;
  onCancel?: (() => void) | undefined;
}) {
  const editMode = !!initial;
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [open, setOpen] = useState(editMode);

  const featureOptions = pickers?.features ?? [];
  const caseOptions = pickers?.cases ?? [];

  if (!open && !editMode)
    return (
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        + Adicionar {blockDef(section.kind).label.toLowerCase()}
      </Button>
    );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
      {section.kind === "evidence" ? <EvidenceGuide /> : null}
      {section.kind === "evidence" && pickers ? (
        <div>
          <Label className="text-xs">Caso ou execução relacionada (opcional)</Label>
          <SearchableSelect
            value={values["case_id"] ?? ""}
            disabled={disabled}
            options={caseOptions}
            placeholder="Sem vínculo"
            emptyMessage="Nenhum caso de teste disponível nesta missão."
            onChange={(id) => setValues((s) => ({ ...s, case_id: id }))}
          />
        </div>
      ) : null}
      {section.kind === "accessibility" ? <A11yGuide /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const isFeaturePicker =
            ((section.kind === "test_case" && f.key === "funcionalidade") ||
              (section.kind === "usability" && f.key === "tela") ||
              (section.kind === "accessibility" && f.key === "titulo")) &&
            !!pickers;
          const isCasePicker =
            ((section.kind === "execution" && f.key === "titulo") ||
              (section.kind === "bug" && f.key === "caso")) &&
            !!pickers;
          const optionalCase = section.kind === "bug";

          if (isFeaturePicker) {
            const allowManual = section.kind !== "test_case";
            return (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                <SearchableSelect
                  value={values["feature_id"] ?? ""}
                  disabled={disabled}
                  options={featureOptions}
                  placeholder={allowManual ? "Selecionar do inventário..." : "Selecione uma funcionalidade..."}
                  emptyMessage="Nenhuma funcionalidade disponível para esta missão. Verifique o Inventário da Aplicação."
                  onChange={(id) => {
                    const opt = featureOptions.find((o) => o.value === id);
                    setValues((s) => ({
                      ...s,
                      feature_id: id,
                      [f.key]: opt ? opt.label : (s[f.key] ?? ""),
                    }));
                  }}
                />
                {allowManual && !values["feature_id"] ? (
                  <Input
                    value={values[f.key] ?? ""}
                    disabled={disabled}
                    placeholder="Ou digite a tela/funcionalidade analisada"
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                ) : null}
              </div>
            );
          }

          if (isCasePicker)
            return (
              <div key={f.key}>
                <Label className="text-xs">
                  Caso de teste relacionado
                  {optionalCase ? " (opcional)" : <span className="text-destructive"> *</span>}
                </Label>
                <SearchableSelect
                  value={values["case_id"] ?? ""}
                  disabled={disabled}
                  options={caseOptions}
                  placeholder={optionalCase ? "Sem vínculo" : "Selecione um caso de teste..."}
                  emptyMessage="Nenhum caso de teste disponível. Crie primeiro um caso de teste nesta missão."
                  onChange={(id) => {
                    const opt = caseOptions.find((o) => o.value === id);
                    setValues((s) => ({
                      ...s,
                      case_id: id,
                      ...(optionalCase
                        ? { caso: opt ? opt.label : "" }
                        : {
                            titulo: opt ? opt.label : "",
                            ...(opt?.expected ? { esperado: opt.expected } : {}),
                          }),
                      ...(opt?.featureId ? { feature_id: opt.featureId } : {}),
                      ...(opt?.featureLabel ? { funcionalidade: opt.featureLabel } : {}),
                    }));
                  }}
                />
                {values["funcionalidade"] ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Funcionalidade: {values["funcionalidade"]}
                  </p>
                ) : null}
              </div>
            );

          return (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <FieldInput
                field={f}
                value={values[f.key] ?? ""}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            </div>
          );
        })}

        {section.kind === "usability" ? (
          <div className="space-y-1">
            <Label className="text-xs">Participante do teste (opcional)</Label>
            <NativeSelect
              value={values["participante_tipo"] ?? ""}
              disabled={disabled}
              onChange={(v) =>
                setValues((s) => ({ ...s, participante_tipo: v, ...(v === "grupo" ? {} : { participante_id: "" }) }))
              }
            >
              <option value="">Não informar</option>
              <option value="grupo">Integrante do grupo</option>
              <option value="externo">Outro participante</option>
              <option value="anonimo">Não identificar (anônimo)</option>
            </NativeSelect>
            {values["participante_tipo"] === "grupo" ? (
              <NativeSelect
                value={values["participante_id"] ?? ""}
                disabled={disabled}
                onChange={(id) => {
                  const opt = (pickers?.members ?? []).find((m) => m.value === id);
                  setValues((s) => ({ ...s, participante_id: id, participante: opt?.label ?? "" }));
                }}
              >
                <option value="">Selecione o integrante...</option>
                {(pickers?.members ?? []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            {values["participante_tipo"] === "externo" ? (
              <Input
                value={values["participante"] ?? ""}
                disabled={disabled}
                placeholder="Nome ou papel do participante (ex.: colega de outra turma)"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setValues((s) => ({ ...s, participante: e.target.value }))
                }
              />
            ) : null}
          </div>
        ) : null}

        {(section.kind === "usability" || section.kind === "accessibility") && pickers ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Evidência desta missão (opcional)</Label>
              <SearchableSelect
                value={values["evidence_entry_id"] ?? ""}
                disabled={disabled}
                options={pickers.evidences ?? []}
                placeholder="Sem vínculo"
                emptyMessage="Nenhuma evidência registrada nesta missão ainda."
                onChange={(id) => setValues((s) => ({ ...s, evidence_entry_id: id }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bug relacionado (opcional)</Label>
              <SearchableSelect
                value={values["bug_entry_id"] ?? ""}
                disabled={disabled}
                options={pickers.bugs ?? []}
                placeholder="Sem vínculo"
                emptyMessage="Nenhum bug registrado nesta missão ainda."
                onChange={(id) => setValues((s) => ({ ...s, bug_entry_id: id }))}
              />
            </div>
          </>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            const url = (values["url"] ?? "").trim();
            const isHttps = (() => {
              try {
                return new URL(url).protocol === "https:";
              } catch {
                return false;
              }
            })();
            if (section.kind === "evidence") {
              if (!(values["descricao"] ?? "").trim()) {
                toast.error("Explique o que esta evidência demonstra.");
                return;
              }
              if (!isHttps && !(values["conteudo"] ?? "").trim()) {
                toast.error("Informe um link válido para a evidência.");
                return;
              }
              if (url && !isHttps) {
                toast.error("Informe um link válido para a evidência.");
                return;
              }
            }
            onSubmit(values);
            if (!editMode) {
              setValues({});
              setOpen(false);
            }
          }}
        >
          {editMode ? "Salvar alterações" : "Salvar registro"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            onCancel?.();
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  index,
  mission,
  state,
  handlers,
  readOnly,
  authorName,
  sectionExtra,
  entryFilter,
  pickers,
  preview = false,
}: {
  section: Section;
  index: number;
  mission: BuilderMission;
  state: PlayerState;
  handlers: PlayerHandlers;
  readOnly: boolean;
  authorName: (id: string) => string;
  sectionExtra?: ((section: Section) => React.ReactNode) | undefined;
  entryFilter?: ((section: Section, entry: MissionEntry) => boolean) | undefined;
  pickers?: MissionPickers | undefined;
  preview?: boolean;
}) {
  const def = blockDef(section.kind);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const isCross = section.kind === "cross_test";
  const answers = state.answers[section.id] ?? {};
  const entries = state.entries.filter(
    (e) => e.section_id === section.id && (entryFilter ? entryFilter(section, e) : true),
  );


  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            <span className="mr-2 text-muted-foreground">{index + 1}.</span>
            {def.icon} {section.title}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {section.required ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">Obrigatório</span>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Opcional</span>
            )}
            {section.xp > 0 ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">+{section.xp} XP</span>
            ) : null}
            {section.indicator_codes.map((c) => (
              <span key={c} className="rounded-md bg-secondary px-2 py-0.5 font-semibold text-primary">
                {c}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectionExtra ? sectionExtra(section) : null}
        {section.description ? <RichText text={section.description} /> : null}

        {def.family === "content" ? (
          section.kind === "material" ? (
            <ul className="space-y-2">
              {((section.items ?? []) as MaterialItem[]).map((m) => (
                <li key={m.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{m.label}</p>
                  {m.description ? <RichText text={m.description} /> : null}
                  {m.link ? (
                    <a className="text-accent underline" href={m.link} target="_blank" rel="noreferrer">
                      Abrir material
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <RichText text={section.body ?? ""} />
          )
        ) : null}

        {section.kind === "checklist" ? (
          <div className="space-y-2">
            {((section.items ?? []) as ChecklistItemDef[]).map((item) => (
              <label key={item.id} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={!!state.checklist[item.id]}
                  disabled={readOnly}
                  onCheckedChange={(c) => handlers.onToggle(item.id, !!c)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        ) : null}

        {def.family === "answers" && section.kind !== "checklist" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(def.answerFields ?? ((section.items ?? []) as QuestionDef[])).map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <FieldInput
                  field={f}
                  value={answers[f.key] ?? ""}
                  disabled={readOnly}
                  onChange={(v) => handlers.onAnswer(section.id, f.key, v)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {isCross && preview ? (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
            🔀 Fluxo Dev × Tester. Na pré-visualização não há aluno nem grupo real: as equipes, os bugs recebidos, a
            atribuição de responsável e o reteste aparecem apenas para um aluno que pertença a um grupo com
            pareamento configurado neste bloco.
          </div>
        ) : null}

        {def.family === "entries" ? (
          <div className="space-y-3">
            {entries.length === 0 ? (
              isCross ? null : (
                <p className="text-sm text-muted-foreground">
                  Nenhum registro ainda. Mínimo esperado: {section.minItems ?? 1}.
                </p>
              )
            ) : (
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={e.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{e.title || "(sem título)"}</p>
                        <p className="text-xs text-muted-foreground">
                          Autoria: {authorName(e.author_id)} ·{" "}
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                          {e.status ? ` · ${e.status}` : ""}
                        </p>
                      </div>
                      {!readOnly && (handlers.canEditEntry?.(e) ?? true) ? (
                        <div className="flex items-center gap-1">
                          {handlers.onUpdateEntry ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingEntry(editingEntry === e.id ? null : e.id)}
                            >
                              {editingEntry === e.id ? "Cancelar" : "Editar"}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  "Tem certeza de que deseja excluir este registro? Esta ação não poderá ser desfeita.",
                                )
                              )
                                return;
                              handlers.onDeleteEntry(e.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                      {Object.entries(e.data ?? {})
                        .filter(([, v]) => (v ?? "").toString().trim())
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                            <dd><RichText text={String(v)} className="space-y-1 text-sm leading-relaxed text-foreground" /></dd>
                          </div>
                        ))}
                    </dl>
                    {e.link ? (
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-accent underline"
                      >
                        🔗 Abrir evidência
                      </a>
                    ) : null}
                    {e.file_path ? (
                      <p className="mt-1 text-xs text-muted-foreground">Arquivo anexado (registro antigo)</p>
                    ) : null}
                    {editingEntry === e.id && handlers.onUpdateEntry && !readOnly ? (
                      <div className="mt-3">
                        <EntryForm
                          section={section}
                          fields={def.fields ?? []}
                          pickers={pickers}
                          disabled={readOnly}
                          initial={{
                            ...(e.data ?? {}),
                            ...(e.feature_id ? { feature_id: e.feature_id } : {}),
                            ...(e.parent_id ? { case_id: e.parent_id } : {}),
                          }}
                          onCancel={() => setEditingEntry(null)}
                          onSubmit={async (values) => {
                            await handlers.onUpdateEntry?.(section, e, values);
                            setEditingEntry(null);
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {!readOnly && !isCross ? (
              <EntryForm
                section={section}
                fields={def.fields ?? []}
                pickers={pickers}
                disabled={readOnly}
                onSubmit={(values) => handlers.onAddEntry(section, values)}
              />
            ) : null}
          </div>
        ) : null}

        {mission.template === "cafe" && section.scope === "individual" ? (
          <p className="text-xs text-muted-foreground">
            Este bloco é individual: sua resposta pertence somente a você.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MissionPlayer({
  mission,
  state,
  handlers,
  readOnly = false,
  progress,
  authorName = (id) => id.slice(0, 8),
  header,
  sectionExtra,
  entryFilter,
  pickers,
  preview = false,
}: {
  mission: BuilderMission;
  state: PlayerState;
  handlers: PlayerHandlers;
  readOnly?: boolean;
  progress: number;
  authorName?: (id: string) => string;
  header?: React.ReactNode;
  sectionExtra?: ((section: Section) => React.ReactNode) | undefined;
  entryFilter?: ((section: Section, entry: MissionEntry) => boolean) | undefined;
  pickers?: MissionPickers | undefined;
  /** Pré-visualização do instrutor: não há aluno/grupo real. */
  preview?: boolean;
}) {
  const sections = (mission.sections ?? []).filter((s) => s.visible);
  return (
    <div className="w-full space-y-5">

      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          {mission.lesson_number ? `Aula ${mission.lesson_number} · ` : ""}
          {mission.template === "cafe" ? "🚀 Café Central" : "🎓 TechEduca"}
        </span>
        <h1 className="mt-1 text-2xl font-bold">{mission.title}</h1>
        {mission.subtitle ? <p className="text-sm text-muted-foreground">{mission.subtitle}</p> : null}
        {mission.objective ? <p className="mt-3 text-sm text-muted-foreground">{mission.objective}</p> : null}
        <div className="mt-4">
          <Progress value={progress} />
          <p className="mt-1 text-xs text-muted-foreground">
            Progresso: {progress}% · concluir 100% não define A/PA/NA — a avaliação é feita pelo instrutor.
          </p>
        </div>
        {header}
      </div>

      {sections.map((s, i) => (
        <SectionCard
          key={s.id}
          section={s}
          index={i}
          mission={mission}
          state={state}
          handlers={handlers}
          readOnly={readOnly}
          authorName={authorName}
          sectionExtra={sectionExtra}
          entryFilter={entryFilter}
          pickers={pickers}
          preview={preview}

        />
      ))}

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta missão ainda não possui blocos.</p>
      ) : null}
    </div>
  );
}
