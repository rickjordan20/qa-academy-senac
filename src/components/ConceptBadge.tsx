export type Concept = "A" | "PA" | "NA" | null | undefined;

const labels: Record<string, string> = {
  A: "Atendido",
  PA: "Parcialmente Atendido",
  NA: "Não Atendido",
};

const icons: Record<string, string> = { A: "✓", PA: "◐", NA: "✕" };

/**
 * Menção do indicador. Nunca converte ausência de avaliação em NA:
 * sem conceito registrado, o estado é sempre "Não avaliado".
 * Usa cor + texto + ícone (não depende apenas de cor).
 */
export function ConceptBadge({ concept, full = false }: { concept: Concept; full?: boolean }) {
  if (!concept) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
        title="Não avaliado"
      >
        <span aria-hidden>—</span>
        <span>Não avaliado</span>
      </span>
    );
  }
  const tone =
    concept === "A"
      ? "bg-success text-success-foreground"
      : concept === "PA"
        ? "bg-warning text-warning-foreground"
        : "bg-danger text-danger-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}
      title={`${concept} — ${labels[concept]}`}
    >
      <span aria-hidden>{icons[concept]}</span>
      <span>{concept}</span>
      {full && <span className="font-normal">— {labels[concept]}</span>}
      <span className="sr-only">{labels[concept]}</span>
    </span>
  );
}
