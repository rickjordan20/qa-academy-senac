import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { evaluateMissionWithAi } from "@/lib/mission-ai-evaluation.functions";
import { mergeSuggestion, type CleanEvaluation, type Conflict, type FormState } from "@/lib/mission-ai-evaluation";
import { useStudentView } from "@/lib/student-view";

// Cache em memória por entrega + impressão digital (entrega e critérios)
const cache = new Map<string, { fp: string; result: CleanEvaluation; aiUsed: boolean }>();

export function AiMissionEvaluation({
  runId,
  fingerprint,
  form,
  touched,
  onApply,
}: {
  runId: string;
  fingerprint: string;
  form: FormState;
  touched: Set<string>;
  onApply: (next: FormState) => void;
}) {
  const view = useStudentView();
  const run = useServerFn(evaluateMissionWithAi);
  const cached = cache.get(runId);
  const [result, setResult] = useState<CleanEvaluation | null>(cached?.fp === fingerprint ? cached.result : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  if (view) return null;

  async function analyze(force = false) {
    const c = cache.get(runId);
    if (!force && c && c.fp === fingerprint) {
      setResult(c.result);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await run({ data: { runId } });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      cache.set(runId, { fp: fingerprint, result: r.result, aiUsed: r.aiUsed });
      setResult(r.result);
      setConflicts(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function apply(overwrite: boolean) {
    if (!result) return;
    const { next, conflicts: found } = mergeSuggestion(form, result, touched, overwrite);
    if (found.length && !overwrite) {
      onApply(next); // aplica só os campos sem conflito
      setConflicts(found);
      toast.message("Sugestões aplicadas nos campos livres. Confirme os campos que você já havia preenchido.");
      return;
    }
    onApply(next);
    setConflicts(null);
    toast.success("Sugestões aplicadas no formulário. Nada foi salvo: revise e aprove para enviar.");
  }

  function discard() {
    cache.delete(runId);
    setResult(null);
    setConflicts(null);
    setError(null);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Avaliação assistida por IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          A IA apenas sugere menções, XP e feedbacks. Nada é salvo nem enviado ao estudante sem a sua aprovação.
        </p>
        {!result ? (
          <Button onClick={() => analyze()} disabled={loading}>
            {loading ? "Analisando entrega…" : "Avaliar com IA"}
          </Button>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="space-y-3">
            {result.alerts.map((a, i) => (
              <p key={i} className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                ⚠️ {a}
              </p>
            ))}
            {result.blocks.map((b) => (
              <div key={b.section_id} className={`rounded-lg border p-3 ${b.needs_review ? "border-warning/50" : "border-border"}`}>
                <p className="font-semibold">
                  {b.title}
                  {b.needs_review ? <span className="ml-2 text-xs text-warning">Revisão docente necessária</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(b.indicators).map(([c, v]) => `${c}: ${v}`).join(" · ") || "Sem menção sugerida"} · XP {b.xp}/{b.xp_max}
                </p>
                {Object.entries(b.justifications).map(([c, j]) => j ? (
                  <p key={c} className="text-xs"><span className="font-semibold">{c}:</span> {j}</p>
                ) : null)}
                {b.feedback ? <p className="mt-1 whitespace-pre-wrap text-xs">{b.feedback}</p> : null}
                {b.evidence_used.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">Evidências: {b.evidence_used.join("; ")}</p>
                ) : null}
                {b.alerts.map((a, i) => <p key={i} className="text-xs text-warning">• {a}</p>)}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Menções finais sugeridas: {Object.entries(result.finals).map(([c, v]) => `${c} ${v}`).join(" · ") || "—"} · XP sugerido {result.xp === null ? "— (decisão docente)" : `${result.xp}/${result.xpCap}`}
            </p>
            {result.overrideNotes ? <p className="whitespace-pre-wrap text-xs">Diferenciações sugeridas: {result.overrideNotes}</p> : null}

            {conflicts?.length ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                <p className="font-semibold">Estes campos já foram preenchidos por você e foram mantidos:</p>
                {conflicts.map((c) => (
                  <p key={c.field}>• {c.label}: atual “{c.current.slice(0, 60)}” → sugerido “{c.suggested.slice(0, 60)}”</p>
                ))}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => apply(true)}>Substituir pelos sugeridos</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConflicts(null)}>Manter os meus</Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => apply(false)}>Aplicar sugestões</Button>
              <Button variant="outline" disabled={loading} onClick={() => analyze(true)}>
                {loading ? "Analisando…" : "Gerar novamente"}
              </Button>
              <Button variant="ghost" onClick={discard}>Descartar análise</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
