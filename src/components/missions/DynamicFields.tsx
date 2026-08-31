import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { FieldDef } from "@/lib/mission-builder";

export function NativeSelect({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
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
  disabled?: boolean;
}) {
  const common = { disabled, placeholder: field.placeholder ?? "" };
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
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
