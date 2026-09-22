import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/missions/DynamicFields";
import type { MissionEntry } from "@/lib/mission-builder";
import {
  crossTestReferenceKey,
  readCrossTestReferences,
  writeCrossTestReferences,
  type CrossTestReference,
  type CrossTestReferenceKind,
} from "@/lib/cross-test-links";

const ENTRY_KIND: Record<string, CrossTestReferenceKind> = {
  test_case: "case",
  bug: "bug",
  evidence: "evidence",
  retest: "retest",
};
const LABEL: Record<CrossTestReferenceKind, string> = {
  case: "Caso de teste",
  bug: "Bug",
  evidence: "Evidência",
  retest: "Reteste",
};

/** Only offer records already supplied by the mission's RLS-filtered query.
 * Selecting a reference does not grant access to its underlying record.
 * The caller persists the returned data in the existing cross_test entry.
 */
export function CrossTestReferences({
  data,
  availableEntries,
  disabled = false,
  onChange,
}: {
  data: MissionEntry["data"];
  availableEntries: MissionEntry[];
  disabled?: boolean;
  onChange: (next: MissionEntry["data"]) => void;
}) {
  const [selected, setSelected] = useState("");
  const references = useMemo(() => readCrossTestReferences(data), [data]);
  const options = useMemo(() => availableEntries.flatMap((entry) => {
    const kind = ENTRY_KIND[entry.kind];
    if (!kind) return [];
    const reference: CrossTestReference = { kind, origin: "mission", id: entry.id };
    return [{ reference, key: crossTestReferenceKey(reference), label: `${LABEL[kind]} — ${entry.title || entry.id}` }];
  }), [availableEntries]);
  const current = new Set(references.map(crossTestReferenceKey));
  const available = options.filter((option) => !current.has(option.key));

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label>Vincular registros existentes da missão</Label>
      <p className="text-xs text-muted-foreground">O vínculo não cria cópias nem altera os registros originais. Registros de outras equipes só poderão aparecer após autorização de acesso no banco.</p>
      {references.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {references.map((reference) => {
            const key = crossTestReferenceKey(reference);
            const option = options.find((item) => item.key === key);
            return (
              <li key={key} className="flex items-center justify-between gap-2">
                <span>{option?.label ?? `${LABEL[reference.kind]} (${reference.origin}) — ${reference.id}`}</span>
                {!disabled ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange(writeCrossTestReferences(data, references.filter((item) => crossTestReferenceKey(item) !== key)))}>Desvincular</Button> : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-xs text-muted-foreground">Nenhum registro vinculado.</p>}
      {!disabled && available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <NativeSelect value={selected} onChange={setSelected}>
            <option value="">Selecione um registro...</option>
            {available.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </NativeSelect>
          <Button type="button" size="sm" disabled={!selected} onClick={() => {
            const option = available.find((item) => item.key === selected);
            if (!option) return;
            onChange(writeCrossTestReferences(data, [...references, option.reference]));
            setSelected("");
          }}>Vincular</Button>
        </div>
      ) : null}
    </div>
  );
}
