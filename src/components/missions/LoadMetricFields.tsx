import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, SearchableSelect, type PickerOption } from "@/components/missions/DynamicFields";
import {
  AGGREGATIONS,
  DURATION_UNITS,
  LOAD_CHECKS,
  LOAD_TOOLS,
  METRIC_UNIT,
  METRICS_CATALOG,
  NO_CHECK,
  OTHER_OPTION,
} from "@/lib/load-metrics";

type Values = Record<string, string>;
type SetValues = React.Dispatch<React.SetStateAction<Values>>;

function Req() {
  return <span className="text-destructive"> *</span>;
}

/** Select de catálogo com opção "Outra" que libera texto livre no mesmo campo. */
function CatalogSelect({
  label,
  required,
  value,
  options,
  otherLabel,
  disabled,
  placeholder,
  searchable,
  onChange,
  hint,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  otherLabel: string;
  disabled: boolean;
  placeholder: string;
  searchable?: boolean;
  onChange: (v: string) => void;
  hint?: string | undefined;
}) {
  const [manual, setManual] = useState(!!value && !options.includes(value));
  const selected = manual ? OTHER_OPTION : value;
  const opts: PickerOption[] = options.map((o) => ({ value: o, label: o }));
  const handle = (v: string) => {
    if (v === OTHER_OPTION) {
      setManual(true);
      onChange(options.includes(value) ? "" : value);
      return;
    }
    setManual(false);
    onChange(v);
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {required ? <Req /> : null}
      </Label>
      {searchable ? (
        <SearchableSelect
          value={selected}
          disabled={disabled}
          options={opts}
          placeholder={placeholder}
          emptyMessage=""
          trailingOption={{ value: OTHER_OPTION, label: otherLabel }}
          onChange={handle}
        />
      ) : (
        <NativeSelect value={selected} disabled={disabled} onChange={handle}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={OTHER_OPTION}>{otherLabel}</option>
        </NativeSelect>
      )}
      {manual ? (
        <Input
          value={value}
          disabled={disabled}
          placeholder="Informe manualmente"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LoadFields({
  values,
  setValues,
  disabled,
  appOptions,
  presetTool,
}: {
  values: Values;
  setValues: SetValues;
  disabled: boolean;
  appOptions: string[];
  presetTool?: string | undefined;
}) {
  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }));
  const checkOptions = [NO_CHECK, ...LOAD_CHECKS];
  const hasCheck = !!values["check"] && values["check"] !== NO_CHECK;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">
          Cenário / nome da execução
          <Req />
        </Label>
        <Input
          value={values["titulo"] ?? ""}
          disabled={disabled}
          placeholder="Ex.: Carga leve, Pico de acesso"
          onChange={(e) => set("titulo")(e.target.value)}
        />
      </div>
      <CatalogSelect
        label="Aplicação / recurso testado"
        required
        value={values["aplicacao"] ?? ""}
        options={appOptions}
        otherLabel="Outro"
        disabled={disabled}
        placeholder="Selecione..."
        searchable={appOptions.length > 6}
        onChange={set("aplicacao")}
        hint={appOptions.length ? "Preenchido pela missão; altere se necessário." : undefined}
      />
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">URL / endpoint</Label>
        <Input
          value={values["endpoint"] ?? ""}
          disabled={disabled}
          placeholder="Ex.: https://... ou /api/login"
          onChange={(e) => set("endpoint")(e.target.value)}
        />
      </div>
      <CatalogSelect
        label="Ferramenta"
        required
        value={values["ferramenta"] ?? ""}
        options={LOAD_TOOLS}
        otherLabel="Outra"
        disabled={disabled}
        placeholder="Selecione a ferramenta..."
        searchable
        onChange={set("ferramenta")}
        hint={presetTool && values["ferramenta"] === presetTool ? "Sugerida pelo instrutor." : undefined}
      />
      <div className="space-y-1">
        <Label className="text-xs">
          Usuários virtuais (VUs)
          <Req />
        </Label>
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={values["vus"] ?? ""}
          disabled={disabled}
          placeholder="Quantidade usada nesta execução"
          onChange={(e) => set("vus")(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">
          Duração
          <Req />
        </Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={values["duracao_valor"] ?? ""}
            disabled={disabled}
            placeholder="Valor"
            onChange={(e) => set("duracao_valor")(e.target.value)}
          />
          <NativeSelect
            value={values["duracao_unidade"] || "segundos"}
            disabled={disabled}
            onChange={set("duracao_unidade")}
          >
            {DURATION_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <CatalogSelect
        label="Check utilizado (opcional)"
        value={values["check"] ?? ""}
        options={checkOptions}
        otherLabel="Outro"
        disabled={disabled}
        placeholder="Selecione..."
        onChange={set("check")}
      />
      {hasCheck ? (
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Resultado do check (preencha o que estiver disponível)</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={values["check_taxa"] ?? ""}
              disabled={disabled}
              placeholder="Taxa de sucesso (%)"
              onChange={(e) => set("check_taxa")(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={values["check_sucessos"] ?? ""}
              disabled={disabled}
              placeholder="Sucessos"
              onChange={(e) => set("check_sucessos")(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={values["check_falhas"] ?? ""}
              disabled={disabled}
              placeholder="Falhas"
              onChange={(e) => set("check_falhas")(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Observação (opcional)</Label>
        <Textarea
          value={values["observacao"] ?? ""}
          disabled={disabled}
          rows={2}
          onChange={(e) => set("observacao")(e.target.value)}
        />
      </div>
    </div>
  );
}

/** Validação do Teste de carga; retorna a mensagem de erro ou null. */
export function validateLoad(v: Values): string | null {
  if (!(v["titulo"] ?? "").trim()) return "Informe o cenário / nome da execução.";
  if (!(v["aplicacao"] ?? "").trim()) return "Informe a aplicação ou recurso testado.";
  if (!(v["ferramenta"] ?? "").trim()) return "Informe a ferramenta utilizada.";
  const vus = Number(v["vus"]);
  if (!Number.isInteger(vus) || vus <= 0) return "Usuários virtuais (VUs) deve ser um número inteiro maior que zero.";
  const dur = Number(v["duracao_valor"]);
  if (!(dur > 0)) return "A duração deve ser maior que zero.";
  const ep = (v["endpoint"] ?? "").trim();
  if (/^[a-z]+:\/\//i.test(ep)) {
    try {
      new URL(ep);
    } catch {
      return "A URL informada não é válida.";
    }
  }
  const taxa = v["check_taxa"];
  if (taxa && (Number(taxa) < 0 || Number(taxa) > 100)) return "A taxa de sucesso deve ficar entre 0 e 100.";
  for (const k of ["check_sucessos", "check_falhas"]) {
    const n = v[k];
    if (n && (!Number.isInteger(Number(n)) || Number(n) < 0)) return "Sucessos e falhas devem ser inteiros.";
  }
  return null;
}

export function MetricFields({
  values,
  setValues,
  disabled,
  runs,
  relational,
}: {
  values: Values;
  setValues: SetValues;
  disabled: boolean;
  runs: PickerOption[];
  /** a missão possui bloco Teste de carga */
  relational: boolean;
}) {
  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }));
  const missingCurrent = !!values["case_id"] && !runs.some((r) => r.value === values["case_id"]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {relational ? (
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">
            Execução / cenário
            {runs.length ? <Req /> : null}
          </Label>
          {runs.length === 0 && !missingCurrent ? (
            <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
              Nenhuma execução de teste de carga encontrada. Registre primeiro uma execução no bloco Teste de carga
              para relacionar esta métrica.
            </p>
          ) : (
            <NativeSelect
              value={values["case_id"] ?? ""}
              disabled={disabled}
              onChange={(id) => {
                const opt = runs.find((r) => r.value === id);
                setValues((s) => ({ ...s, case_id: id, execucao_label: opt?.label ?? "" }));
              }}
            >
              <option value="">Selecione a execução...</option>
              {runs.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
      ) : null}
      <CatalogSelect
        label="Métrica"
        required
        value={values["titulo"] ?? ""}
        options={METRICS_CATALOG}
        otherLabel="Outra"
        disabled={disabled}
        placeholder="Selecione a métrica..."
        searchable
        onChange={(m) =>
          setValues((s) => {
            const prevSuggested = METRIC_UNIT[s["titulo"] ?? ""] ?? "";
            const unitUntouched = !(s["unidade"] ?? "") || s["unidade"] === prevSuggested;
            const next = METRIC_UNIT[m];
            return { ...s, titulo: m, ...(unitUntouched ? { unidade: next ?? "" } : {}) };
          })
        }
      />
      <CatalogSelect
        label="Aggregation"
        required
        value={values["agregacao"] ?? ""}
        options={AGGREGATIONS}
        otherLabel="Outra"
        disabled={disabled}
        placeholder="Selecione a agregação..."
        searchable
        onChange={set("agregacao")}
      />
      <div className="space-y-1">
        <Label className="text-xs">Valor</Label>
        <Input
          type="number"
          step="any"
          value={values["valor"] ?? ""}
          disabled={disabled}
          placeholder="Ex.: 245 ou 0.5"
          onChange={(e) => set("valor")(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Unidade</Label>
        <Input
          value={values["unidade"] ?? ""}
          disabled={disabled}
          placeholder="Ex.: ms, req/s, %"
          onChange={(e) => set("unidade")(e.target.value)}
        />
        {METRIC_UNIT[values["titulo"] ?? ""] && values["unidade"] === METRIC_UNIT[values["titulo"] ?? ""] ? (
          <p className="text-[11px] text-muted-foreground">Sugerida pela métrica; pode alterar.</p>
        ) : null}
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">
          Interpretação
          <Req />
        </Label>
        <Textarea
          value={values["interpretacao"] ?? ""}
          disabled={disabled}
          rows={3}
          placeholder="Explique o que este resultado representa."
          onChange={(e) => set("interpretacao")(e.target.value)}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Observação (opcional)</Label>
        <Textarea
          value={values["observacao"] ?? ""}
          disabled={disabled}
          rows={2}
          onChange={(e) => set("observacao")(e.target.value)}
        />
      </div>
    </div>
  );
}

export function validateMetric(v: Values, runsAvailable: boolean): string | null {
  if (runsAvailable && !v["case_id"]) return "Selecione a execução de teste de carga desta métrica.";
  if (!(v["titulo"] ?? "").trim()) return "Selecione ou informe a métrica.";
  if (!(v["agregacao"] ?? "").trim()) return "Selecione ou informe a Aggregation.";
  const val = (v["valor"] ?? "").trim();
  if (val && Number.isNaN(Number(val))) return "O valor deve ser numérico (use ponto para decimais).";
  if (!(v["interpretacao"] ?? "").trim()) return "Explique a interpretação desta métrica.";
  return null;
}
