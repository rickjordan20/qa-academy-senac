import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EvidenceGuide } from "@/components/EvidenceGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FieldInput, SearchableSelect, type PickerOption } from "@/components/missions/DynamicFields";
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

export type PlayerHandlers = {
  onAnswer: (sectionId: string, key: string, value: string) => void;
  onToggle: (itemId: string, value: boolean) => void;
  onAddEntry: (section: Section, values: Record<string, string>) => Promise<void> | void;
  onDeleteEntry: (id: string) => void;
};

function EntryForm({
  section,
  fields,
  disabled,
  pickers,
  onSubmit,
}: {
  section: Section;
  fields: FieldDef[];
  disabled: boolean;
  pickers?: MissionPickers | undefined;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  const featureOptions = pickers?.features ?? [];
  const caseOptions = pickers?.cases ?? [];

  if (!open)
    return (
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        + Adicionar {blockDef(section.kind).label.toLowerCase()}
      </Button>
    );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
      {section.kind === "evidence" ? <EvidenceGuide /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const isFeaturePicker = section.kind === "test_case" && f.key === "funcionalidade" && !!pickers;
          const isCasePicker = section.kind === "execution" && f.key === "titulo" && !!pickers;

          if (isFeaturePicker)
            return (
              <div key={f.key}>
                <Label className="text-xs">
                  Funcionalidade<span className="text-destructive"> *</span>
                </Label>
                <SearchableSelect
                  value={values["feature_id"] ?? ""}
                  disabled={disabled}
                  options={featureOptions}
                  placeholder="Selecione uma funcionalidade..."
                  emptyMessage="Nenhuma funcionalidade disponível para esta missão. Verifique o Inventário da Aplicação."
                  onChange={(id) => {
                    const opt = featureOptions.find((o) => o.value === id);
                    setValues((s) => ({
                      ...s,
                      feature_id: id,
                      funcionalidade: opt ? opt.label : "",
                    }));
                  }}
                />
              </div>
            );

          if (isCasePicker)
            return (
              <div key={f.key}>
                <Label className="text-xs">
                  Caso de teste relacionado<span className="text-destructive"> *</span>
                </Label>
                <SearchableSelect
                  value={values["case_id"] ?? ""}
                  disabled={disabled}
                  options={caseOptions}
                  placeholder="Selecione um caso de teste..."
                  emptyMessage="Nenhum caso de teste disponível. Crie primeiro um caso de teste nesta missão."
                  onChange={(id) => {
                    const opt = caseOptions.find((o) => o.value === id);
                    setValues((s) => ({
                      ...s,
                      case_id: id,
                      titulo: opt ? opt.label : "",
                      ...(opt?.expected ? { esperado: opt.expected } : {}),
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
            setValues({});
            setOpen(false);
          }}
        >
          Salvar registro
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
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
}) {
  const def = blockDef(section.kind);
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

        {def.family === "entries" ? (
          <div className="space-y-3">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum registro ainda. Mínimo esperado: {section.minItems ?? 1}.
              </p>
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
                      {!readOnly ? (
                        <Button size="sm" variant="ghost" onClick={() => handlers.onDeleteEntry(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                  </li>
                ))}
              </ul>
            )}
            {!readOnly ? (
              <EntryForm
                section={section}
                fields={def.fields ?? []}
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

        />
      ))}

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta missão ainda não possui blocos.</p>
      ) : null}
    </div>
  );
}
