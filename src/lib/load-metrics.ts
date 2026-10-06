/**
 * Catálogos e utilitários dos blocos "Teste de carga" e "Métricas".
 * Catálogos são sugestões: todos aceitam "Outra/Outro" com valor livre.
 * Nenhum valor de execução (VUs, duração) é fixado aqui.
 */

export const OTHER_OPTION = "__other__";

export const LOAD_TOOLS = [
  "Grafana Cloud k6",
  "JMeter",
  "Postman",
  "Lighthouse",
  "Playwright",
  "Selenium",
  "DevTools",
];

export const DURATION_UNITS = ["segundos", "minutos", "horas"] as const;
const UNIT_SHORT: Record<string, string> = { segundos: "s", minutos: "min", horas: "h" };

/** Checks (verificações de resposta). Thresholds não entram aqui de propósito. */
export const LOAD_CHECKS = ["HTTP status code = 200", "HTTP status code = 201", "Response contains..."];
export const NO_CHECK = "Nenhum";

export const METRICS_CATALOG = [
  "HTTP Response Time",
  "HTTP Request Rate",
  "HTTP Failure Rate",
  "VUs",
  "Max VUs",
  "Iterations",
  "Iteration Duration",
  "Checks",
];

/** Unidade sugerida por métrica específica (sempre editável). */
export const METRIC_UNIT: Record<string, string> = {
  "HTTP Response Time": "ms",
  "Iteration Duration": "ms",
  "HTTP Request Rate": "req/s",
  "HTTP Failure Rate": "%",
  VUs: "VUs",
  "Max VUs": "VUs",
  Iterations: "iterações",
  Checks: "%",
};

export const AGGREGATIONS = [
  "Min",
  "Max",
  "Avg",
  "Median",
  "Rate",
  "75th percentile (p75)",
  "90th percentile (p90)",
  "95th percentile (p95)",
  "99th percentile (p99)",
  "Std. Dev.",
  "Increase",
  "Cum. Count",
  "Cum. Min",
  "Cum. Max",
  "Cum. Avg",
  "Cum. Std. Dev.",
];

export const PROJECT_APPS: Record<string, string> = {
  techeduca: "TechEduca",
  cafe_central: "Café Central",
};

export function projectAppLabel(project: string | null | undefined): string {
  if (!project) return "";
  return PROJECT_APPS[project] ?? project;
}

type Data = Record<string, unknown>;
const s = (d: Data, k: string) => (d[k] ?? "").toString().trim();

export function formatDuration(d: Data): string {
  const v = s(d, "duracao_valor");
  if (!v) return "";
  const u = s(d, "duracao_unidade") || "segundos";
  return `${v} ${u}`;
}

/** Rótulo de uma execução para o Select de Métricas: "Carga leve — 5 VUs — 10s". */
export function loadRunLabel(title: string, d: Data): string {
  const parts = [title || "(sem nome)"];
  const vus = s(d, "vus");
  if (vus) parts.push(`${vus} VUs`);
  const v = s(d, "duracao_valor");
  if (v) parts.push(`${v}${UNIT_SHORT[s(d, "duracao_unidade")] ?? "s"}`);
  return parts.join(" — ");
}

export function formatCheckResult(d: Data): string {
  const out: string[] = [];
  if (s(d, "check_taxa")) out.push(`${s(d, "check_taxa")}% de sucesso`);
  if (s(d, "check_sucessos")) out.push(`${s(d, "check_sucessos")} sucessos`);
  if (s(d, "check_falhas")) out.push(`${s(d, "check_falhas")} falhas`);
  return out.join(" · ");
}

/** Registros criados antes da estruturação (não exigem os novos campos obrigatórios). */
export function isLegacyEntry(kind: string, d: Data): boolean {
  if (kind === "load") return !s(d, "vus") && !s(d, "duracao_valor") && !s(d, "aplicacao");
  if (kind === "metrics") return !s(d, "agregacao") && !s(d, "execucao_label") && !!s(d, "referencia");
  return false;
}

/** Rótulos de campos antigos, mantidos legíveis nos registros históricos. */
export const LEGACY_LOAD_METRIC_LABELS: Record<string, string> = {
  recurso: "Recurso / rota / endpoint",
  cenario: "Cenário (registro anterior)",
  configuracao: "Configuração",
  usuarios: "Usuários / requisições",
  duracao: "Duração (registro anterior)",
  ambiente: "Ambiente",
  resultado: "Resultado",
  conclusao: "Conclusão",
  referencia: "Referência",
};

/**
 * Pares rótulo/valor de exibição para load/metrics, agrupando duração e resultado do check.
 * Retorna null para outros blocos (que seguem a exibição genérica).
 */
export function loadMetricDisplayPairs(
  kind: string,
  d: Data,
  opts?: { parentMissing?: boolean },
): { key: string; label: string; value: string }[] | null {
  if (kind !== "load" && kind !== "metrics") return null;
  const pairs: { key: string; label: string; value: string }[] = [];
  const push = (key: string, label: string, value: string) => {
    if (value) pairs.push({ key, label, value });
  };
  const legacyTitleLabel = isLegacyEntry(kind, d)
    ? kind === "load"
      ? "Objetivo"
      : "Nome da métrica"
    : kind === "load"
      ? "Cenário / nome da execução"
      : "Métrica";
  if (kind === "load") {
    push("titulo", legacyTitleLabel, s(d, "titulo"));
    push("aplicacao", "Aplicação / recurso testado", s(d, "aplicacao"));
    push("endpoint", "URL / endpoint", s(d, "endpoint"));
    push("ferramenta", "Ferramenta", s(d, "ferramenta"));
    push("vus", "Usuários virtuais (VUs)", s(d, "vus"));
    push("duracao", "Duração", formatDuration(d));
    push("check", "Check utilizado", s(d, "check"));
    push("check_resultado", "Resultado do check", formatCheckResult(d));
  } else {
    const exec = s(d, "execucao_label");
    push(
      "execucao_label",
      "Execução / cenário",
      exec ? (opts?.parentMissing ? `${exec} (execução excluída)` : exec) : "",
    );
    push("titulo", legacyTitleLabel, s(d, "titulo"));
    push("agregacao", "Aggregation", s(d, "agregacao"));
    const val = s(d, "valor");
    push("valor", "Valor", val ? `${val}${s(d, "unidade") ? ` ${s(d, "unidade")}` : ""}` : "");
    if (!val) push("unidade", "Unidade", s(d, "unidade"));
    push("interpretacao", "Interpretação", s(d, "interpretacao"));
  }
  push("observacao", "Observação", s(d, "observacao"));
  for (const [k, label] of Object.entries(LEGACY_LOAD_METRIC_LABELS)) push(k, label, s(d, k));
  return pairs;
}
