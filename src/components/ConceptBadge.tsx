export type Concept = "A" | "PA" | "NA" | null | undefined;

const labels: Record<string, string> = {
  A: "Atendido",
  PA: "Parcialmente Atendido",
  NA: "Não Atendido",
};

export function ConceptBadge({ concept }: { concept: Concept }) {
  if (!concept) {
    return (
      <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
        Não avaliado
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
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`} title={labels[concept]}>
      {concept}
    </span>
  );
}
