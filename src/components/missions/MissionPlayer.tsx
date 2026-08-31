import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FieldInput } from "@/components/missions/DynamicFields";
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
  onAddEntry: (section: Section, values: Record<string, string>, file: File | null) => Promise<void> | void;
  onDeleteEntry: (id: string) => void;
};

/** Texto simples com quebras de linha e listas leves. */
function RichText({ text }: { text: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-2" />;
        if (t.startsWith("## ")) return <h4 key={i} className="text-sm font-semibold text-foreground">{t.slice(3)}</h4>;
        if (t.startsWith("- ")) return <p key={i} className="pl-4">• {t.slice(2)}</p>;
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

function EntryForm({
  section,
  fields,
  disabled,
  onSubmit,
}: {
  section: Section;
  fields: FieldDef[];
  disabled: boolean;
  onSubmit: (values: Record<string, string>, file: File | null) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        + Adicionar {blockDef(section.kind).label.toLowerCase()}
      </Button>
    );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <FieldInput
              field={f}
              value={values[f.key] ?? ""}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
          </div>
        ))}
        {section.kind === "evidence" ? (
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Arquivo (opcional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSubmit(values, file);
            setValues({});
            setFile(null);
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
}: {
  section: Section;
  index: number;
  mission: BuilderMission;
  state: PlayerState;
  handlers: PlayerHandlers;
  readOnly: boolean;
  authorName: (id: string) => string;
}) {
  const def = blockDef(section.kind);
  const answers = state.answers[section.id] ?? {};
  const entries = state.entries.filter((e) => e.section_id === section.id);

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
        {section.description ? <p className="text-sm text-muted-foreground">{section.description}</p> : null}
        {def.family === "content" ? (
          section.kind === "material" ? (
            <ul className="space-y-2">
              {((section.items ?? []) as MaterialItem[]).map((m) => (
                <li key={m.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{m.label}</p>
                  {m.description ? <p className="text-muted-foreground">{m.description}</p> : null}
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
                            <dd className="whitespace-pre-wrap">{v}</dd>
                          </div>
                        ))}
                    </dl>
                    {e.file_path ? <p className="mt-1 text-xs text-muted-foreground">Arquivo anexado</p> : null}
                  </li>
                ))}
              </ul>
            )}
            {!readOnly ? (
              <EntryForm
                section={section}
                fields={def.fields ?? []}
                disabled={readOnly}
                onSubmit={(values, file) => handlers.onAddEntry(section, values, file)}
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
}: {
  mission: BuilderMission;
  state: PlayerState;
  handlers: PlayerHandlers;
  readOnly?: boolean;
  progress: number;
  authorName?: (id: string) => string;
  header?: React.ReactNode;
}) {
  const sections = (mission.sections ?? []).filter((s) => s.visible);
  return (
    <div className="max-w-4xl space-y-5">
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
        />
      ))}

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta missão ainda não possui blocos.</p>
      ) : null}
    </div>
  );
}
