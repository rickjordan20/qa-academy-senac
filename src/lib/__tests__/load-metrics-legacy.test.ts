import { describe, expect, it } from "vitest";
import { isLegacyEntry, legacyFieldKeys } from "@/lib/load-metrics";
import { validateLegacy, validateLoad, validateMetric } from "@/components/missions/LoadMetricFields";

describe("registros antigos de Teste de carga", () => {
  const hybrid = {
    titulo: "Avaliar carga leve",
    cenario: "Carga leve — 5 VUs",
    configuracao: "5 usuários virtuais",
    usuarios: "5 VUs",
    duracao: "10 segundos",
    recurso: "https://x",
    ambiente: "Produção",
    resultado: "50 req",
    conclusao: "OK",
    vus: "5",
    duracao_valor: "10",
    aplicacao: "TechEduca",
    ferramenta: "Grafana Cloud k6",
  };
  it("expõe os campos antigos com os nomes exatos gravados (configuracao, não config)", () => {
    expect(legacyFieldKeys("load", hybrid)).toEqual([
      "recurso", "cenario", "configuracao", "usuarios", "duracao", "ambiente", "resultado", "conclusao",
    ]);
  });
  it("registro novo não tem campos antigos e segue a validação atual", () => {
    expect(legacyFieldKeys("load", { titulo: "x", vus: "5" })).toEqual([]);
    expect(validateLoad({ titulo: "x" })).not.toBeNull();
  });
  it("registro antigo puro é legado e não exige VUs/duração", () => {
    const old = { titulo: "Objetivo", cenario: "c", resultado: "r" };
    expect(isLegacyEntry("load", old)).toBe(true);
    expect(validateLegacy("load", old)).toBeNull();
  });
});

describe("métricas antigas", () => {
  it("é legado mesmo sem referência", () => {
    expect(isLegacyEntry("metrics", { titulo: "Bugs", valor: "3", interpretacao: "i" })).toBe(true);
  });
  it("é legado com referência e a mantém editável", () => {
    const d = { titulo: "Bugs", referencia: "BUG-001" };
    expect(isLegacyEntry("metrics", d)).toBe(true);
    expect(legacyFieldKeys("metrics", d)).toEqual(["referencia"]);
  });
  it("registro novo (com execução, agregação ou vínculo) não é legado", () => {
    expect(isLegacyEntry("metrics", { titulo: "x", agregacao: "Avg" })).toBe(false);
    expect(isLegacyEntry("metrics", { titulo: "x", execucao_label: "Carga" })).toBe(false);
    expect(isLegacyEntry("metrics", { titulo: "x", case_id: "abc" })).toBe(false);
  });
  it("validações atuais continuam valendo para novos registros", () => {
    expect(validateMetric({ titulo: "x", interpretacao: "i" }, false)).toMatch(/Aggregation/);
    expect(validateMetric({ titulo: "x", agregacao: "Avg", interpretacao: "i" }, true)).toMatch(/execução/);
  });
});
