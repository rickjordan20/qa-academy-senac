import { describe, expect, it } from "vitest";
import {
  CLASSIC_REPORT_FIELDS,
  answerFieldsOf,
  computeProgress,
  missingRequiredReportFields,
  orderedAnswerPairs,
  reportModelFields,
  type BuilderMission,
  type MissionRun,
  type Section,
} from "@/lib/mission-builder";

const base = (p: Partial<Section>): Section =>
  ({ id: "s1", kind: "report", title: "Relatório", description: "", required: true, scope: "individual", xp: 0, indicator_codes: [], visible: true, ...p }) as Section;
const mission = (sections: Section[]) => ({ sections }) as unknown as BuilderMission;
const run = (answers: Record<string, Record<string, string>>) => ({ answers, checklist_state: {} }) as unknown as MissionRun;

describe("bloco Relatório", () => {
  it("relatório antigo (sem configuração) mantém o modelo completo e as respostas", () => {
    const s = base({});
    expect(answerFieldsOf(s).map((f) => f.key)).toEqual(CLASSIC_REPORT_FIELDS.map((f) => f.key));
    expect(CLASSIC_REPORT_FIELDS.length).toBe(14);
    const r = run({ s1: { resumo: "ok" } });
    expect(computeProgress(mission([s]), r, [])).toBe(100);
    expect(orderedAnswerPairs(s, { resumo: "ok" })).toEqual([{ label: "Resumo", value: "ok" }]);
    expect(missingRequiredReportFields(mission([s]), {})).toEqual([]);
  });

  it("Dossiê de Qualidade: 6 campos texto longo, obrigatórios contam no progresso e na entrega", () => {
    const fields = reportModelFields("dossie");
    expect(fields.length).toBe(6);
    expect(fields.every((f) => f.type === "textarea" && f.required)).toBe(true);
    fields[5]!.required = false;
    const s = base({ reportFields: fields, reportModel: "dossie" });
    const partial: Record<string, string> = Object.fromEntries(fields.slice(0, 4).map((f) => [f.key, "x"]));
    expect(computeProgress(mission([s]), run({ s1: partial }), [])).toBe(0);
    expect(missingRequiredReportFields(mission([s]), { s1: partial })).toHaveLength(1);
    partial[fields[4]!.key] = "x";
    expect(computeProgress(mission([s]), run({ s1: partial }), [])).toBe(100);
    expect(missingRequiredReportFields(mission([s]), { s1: partial })).toEqual([]);
  });

  it("relatório com 3 campos: ordem, desativado não é exigido, respostas de campo removido preservadas", () => {
    const s = base({
      reportFields: [
        { id: "a", key: "k2", label: "Segundo", type: "number", required: true },
        { id: "b", key: "k1", label: "Primeiro", type: "scale", required: true },
        { id: "c", key: "k3", label: "Off", type: "text", required: true, disabled: true },
      ],
    });
    expect(answerFieldsOf(s).map((f) => f.key)).toEqual(["k2", "k1"]);
    expect(missingRequiredReportFields(mission([s]), { s1: { k1: "3", k2: "5" } })).toEqual([]);
    expect(orderedAnswerPairs(s, { k1: "3", k2: "5", velho: "v" })).toEqual([
      { label: "Segundo", value: "5" },
      { label: "Primeiro", value: "3" },
      { label: "velho (campo removido)", value: "v" },
    ]);
  });
});
