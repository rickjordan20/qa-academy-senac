import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import type { BlockResult, RunEvaluation } from "@/lib/mission-submissions";

/**
 * Avaliação a exibir ao aluno: a vigente; senão a mais recente do histórico
 * (ex.: revisão solicitada grava is_current=false). Nunca altera dados.
 */
export function pickDisplayEvaluation(evaluations: RunEvaluation[] | undefined | null) {
  if (!evaluations?.length) return null;
  const current = evaluations.find((e) => e.is_current);
  if (current) return { evaluation: current, isCurrent: true };
  const latest = [...evaluations].sort((a, b) => b.version - a.version)[0]!;
  return { evaluation: latest, isCurrent: false };
}

/** true quando o bloco tem algo a mostrar (menção ou comentário). */
export function hasBlockFeedback(result: BlockResult | undefined | null) {
  if (!result) return false;
  const concepts = Object.values(result.indicators ?? {}).filter(Boolean);
  return concepts.length > 0 || !!result.comment?.trim();
}

export function BlockFeedback({
  result,
  isCurrent = true,
  version,
}: {
  result: BlockResult | undefined | null;
  isCurrent?: boolean | undefined;
  version?: number | undefined;
}) {
  if (!result || !hasBlockFeedback(result)) return null;
  const concepts = Object.entries(result.indicators ?? {}).filter(([, c]) => c);
  const needsAttention = concepts.some(([, c]) => c === "PA" || c === "NA");
  const tone = needsAttention ? "border-warning bg-warning/10" : concepts.length ? "border-success bg-success/10" : "border-accent bg-accent/10";

  return (
    <div className={`mb-4 rounded-r-md border-l-4 p-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {needsAttention ? "⚠ Precisa de ajustes" : concepts.length ? "✓ Bloco avaliado" : "Orientação do instrutor"}
        </p>
        <span className="text-[11px] text-muted-foreground">
          {isCurrent ? "Avaliação vigente" : "Avaliação da revisão solicitada"}
          {version ? ` · versão ${version}` : ""}
        </span>
      </div>
      {concepts.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {concepts.map(([code, concept]) => (
            <span key={code} className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-semibold">{code}</span>
              <ConceptBadge concept={concept as Concept} full />
            </span>
          ))}
        </div>
      ) : null}
      {result.comment?.trim() ? (
        <div className={concepts.length ? "mt-3 border-t border-border/50 pt-3" : "mt-2"}>
          <p className="text-xs font-semibold">Feedback do instrutor</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{result.comment}</p>
        </div>
      ) : null}
      {needsAttention ? (
        <p className="mt-2 text-xs font-medium text-warning">Revise este bloco seguindo as orientações acima.</p>
      ) : null}
    </div>
  );
}
