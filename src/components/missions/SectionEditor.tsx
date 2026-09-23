import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKDOWN_HINT } from "@/components/missions/RichText";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { CrossTestPairingEditor } from "@/components/missions/CrossTestPairingEditor";
import {
  blockDef,
  uid,
  type ChecklistItemDef,
  type FieldType,
  type MaterialItem,
  type QuestionDef,
  type Section,
} from "@/lib/mission-builder";

const INDICATORS = ["I1", "I2", "I3", "I4", "I5", "I6"];

const QUESTION_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Resposta curta" },
  { value: "textarea", label: "Resposta longa" },
  { value: "select", label: "Seleção única" },
  { value: "multiselect", label: "Múltipla seleção" },
  { value: "boolean", label: "Verdadeiro/Falso" },
  { value: "scale", label: "Escala 1-5" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "time", label: "Horário" },
  { value: "url", label: "URL" },
];

export function SectionEditor({
  section,
  index,
  total,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  missionId,
  classIds,
}: {
  section: Section;
  index: number;
  total: number;
  onChange: (patch: Partial<Section>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  missionId?: string | undefined;
  classIds?: string[] | undefined;
}) {
  const def = blockDef(section.kind);
  const items = section.items ?? [];

  const isQuestionLike =
    section.kind === "questions" ||
    section.kind === "custom_fields" ||
    section.kind === "reflection" ||
    section.kind === "checkpoint";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {def.icon} {def.label}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Título do bloco</Label>
            <Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">XP do bloco</Label>
            <Input
              type="number"
              value={section.xp}
              onChange={(e) => onChange({ xp: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Descrição / orientação ao aluno</Label>
            <Textarea rows={3} value={section.description} onChange={(e) => onChange({ description: e.target.value })} />
            <p className="text-[11px] text-muted-foreground">{MARKDOWN_HINT}</p>
          </div>
        </div>

        {def.family === "content" && section.kind !== "material" ? (
          <div className="space-y-1">
            <Label className="text-xs">Texto ({"##"} título, {"-"} lista)</Label>
            <Textarea rows={6} value={section.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
            <p className="text-[11px] text-muted-foreground">{MARKDOWN_HINT}</p>
          </div>
        ) : null}

        {section.kind === "material" ? (
          <div className="space-y-2">
            {(items as MaterialItem[]).map((m, i) => (
              <div key={m.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
                <Input
                  placeholder="Título"
                  value={m.label}
                  onChange={(e) => {
                    const next = [...(items as MaterialItem[])];
                    next[i] = { ...m, label: e.target.value };
                    onChange({ items: next });
                  }}
                />
                <Textarea
                  rows={2}
                  placeholder="Descrição (## título, - lista)"
                  value={m.description ?? ""}
                  onChange={(e) => {
                    const next = [...(items as MaterialItem[])];
                    next[i] = { ...m, description: e.target.value };
                    onChange({ items: next });
                  }}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Link"
                    value={m.link ?? ""}
                    onChange={(e) => {
                      const next = [...(items as MaterialItem[])];
                      next[i] = { ...m, link: e.target.value };
                      onChange({ items: next });
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({ items: (items as MaterialItem[]).filter((x) => x.id !== m.id) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChange({ items: [...(items as MaterialItem[]), { id: uid(), label: "", link: "" }] })}
            >
              + Item de material
            </Button>
          </div>
        ) : null}

        {section.kind === "checklist" ? (
          <div className="space-y-2">
            {(items as ChecklistItemDef[]).map((it, i) => (
              <div key={it.id} className="flex gap-2">
                <Input
                  value={it.label}
                  onChange={(e) => {
                    const next = [...(items as ChecklistItemDef[])];
                    next[i] = { ...it, label: e.target.value };
                    onChange({ items: next });
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ items: (items as ChecklistItemDef[]).filter((x) => x.id !== it.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChange({ items: [...(items as ChecklistItemDef[]), { id: uid(), label: "" }] })}
            >
              + Item do checklist
            </Button>
          </div>
        ) : null}

        {isQuestionLike ? (
          <div className="space-y-2">
            {(items as QuestionDef[]).map((q, i) => (
              <div key={q.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                <Input
                  placeholder="Pergunta / rótulo do campo"
                  value={q.label}
                  onChange={(e) => {
                    const next = [...(items as QuestionDef[])];
                    next[i] = { ...q, label: e.target.value };
                    onChange({ items: next });
                  }}
                />
                <NativeSelect
                  value={q.type}
                  onChange={(v) => {
                    const next = [...(items as QuestionDef[])];
                    next[i] = { ...q, type: v as FieldType };
                    onChange({ items: next });
                  }}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
                {q.type === "select" || q.type === "multiselect" ? (
                  <Input
                    className="sm:col-span-2"
                    placeholder="Opções separadas por ; (ex.: Sim;Não;Parcial)"
                    value={(q.options ?? []).join(";")}
                    onChange={(e) => {
                      const next = [...(items as QuestionDef[])];
                      next[i] = { ...q, options: e.target.value.split(";").map((s) => s.trim()).filter(Boolean) };
                      onChange({ items: next });
                    }}
                  />
                ) : null}
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={!!q.required}
                    onCheckedChange={(c) => {
                      const next = [...(items as QuestionDef[])];
                      next[i] = { ...q, required: !!c };
                      onChange({ items: next });
                    }}
                  />
                  Obrigatória
                </label>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({ items: (items as QuestionDef[]).filter((x) => x.id !== q.id) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const id = uid();
                onChange({
                  items: [...(items as QuestionDef[]), { id, key: id, label: "", type: "textarea" as FieldType }],
                });
              }}
            >
              + Pergunta / campo
            </Button>
          </div>
        ) : null}

        {section.kind === "cross_test" && missionId ? (
          <CrossTestPairingEditor
            missionId={missionId}
            sectionId={section.id}
            classIds={classIds ?? []}
          />
        ) : null}

        {def.family === "entries" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade mínima de registros</Label>
              <Input
                type="number"
                min={0}
                value={section.minItems ?? 1}
                onChange={(e) => onChange({ minItems: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade máxima (0 = livre)</Label>
              <Input
                type="number"
                min={0}
                value={section.maxItems ?? 0}
                onChange={(e) => onChange({ maxItems: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
          <label className="flex items-center gap-2">
            <Checkbox checked={section.required} onCheckedChange={(c) => onChange({ required: !!c })} />
            Obrigatório
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={section.visible} onCheckedChange={(c) => onChange({ visible: !!c })} />
            Visível ao aluno
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Escopo:</span>
            <NativeSelect
              value={section.scope}
              onChange={(v) => onChange({ scope: v as Section["scope"] })}
            >
              <option value="individual">Individual</option>
              <option value="group">Grupo</option>
            </NativeSelect>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Indicadores:</span>
            {INDICATORS.map((code) => {
              const on = section.indicator_codes.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() =>
                    onChange({
                      indicator_codes: on
                        ? section.indicator_codes.filter((c) => c !== code)
                        : [...section.indicator_codes, code],
                    })
                  }
                  className={`rounded-md px-2 py-0.5 font-semibold ${
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
