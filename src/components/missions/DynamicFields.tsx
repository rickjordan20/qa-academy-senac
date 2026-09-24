import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RichText } from "@/components/missions/RichText";
import type { FieldDef } from "@/lib/mission-builder";

export type PickerOption = {
  /** id real do registro relacionado */
  value: string;
  label: string;
  /** agrupamento visual (Módulo/Tela) */
  group?: string | undefined;
};

/** Select pesquisável simples (filtro + <select> com optgroup), sem dependências novas. */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage,
  disabled,
  trailingOption,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  placeholder: string;
  emptyMessage: string;
  disabled?: boolean | undefined;
  /** opção fixa exibida sempre por último (ex.: "+ Informar outra funcionalidade") */
  trailingOption?: PickerOption | undefined;
}) {
  const [term, setTerm] = useState("");
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => `${o.group ?? ""} ${o.label}`.toLowerCase().includes(t));
  }, [options, term]);

  const groups = useMemo(() => {
    const map = new Map<string, PickerOption[]>();
    for (const o of filtered) {
      const key = o.group ?? "";
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()];
  }, [filtered]);

  if (options.length === 0) return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;

  return (
    <div className="space-y-1">
      <Input
        value={term}
        disabled={disabled}
        placeholder="Pesquisar..."
        onChange={(e) => setTerm(e.target.value)}
        className="h-8 text-xs"
      />
      <NativeSelect value={value} onChange={onChange} disabled={disabled}>
        <option value="">{placeholder}</option>
        {groups.map(([g, opts]) =>
          g ? (
            <optgroup key={g} label={g}>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </NativeSelect>
    </div>
  );
}

export function NativeSelect({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean | undefined;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      {children}
    </select>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean | undefined;
}) {
  const common = { disabled, placeholder: field.placeholder ?? "" };
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {field.description ? (
        <RichText text={field.description} className="space-y-1 text-xs leading-relaxed text-muted-foreground" />
      ) : null}
      {field.type === "textarea" ? (
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...common} />
      ) : field.type === "select" ? (
        <NativeSelect value={value} onChange={onChange} disabled={disabled}>
          <option value="">Selecione...</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-3 rounded-md border border-input p-2">
          {(field.options ?? []).map((o) => {
            const parts = value ? value.split("|") : [];
            const checked = parts.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(c) =>
                    onChange((c ? [...parts, o] : parts.filter((p) => p !== o)).join("|"))
                  }
                />
                {o}
              </label>
            );
          })}
        </div>
      ) : field.type === "checkbox" || field.type === "boolean" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value === "true"}
            disabled={disabled}
            onCheckedChange={(c) => onChange(c ? "true" : "false")}
          />
          Confirmo
        </label>
      ) : field.type === "scale" ? (
        <NativeSelect value={value} onChange={onChange} disabled={disabled}>
          <option value="">Selecione...</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input
          type={
            field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      )}
    </div>
  );
}
