import { useRecoveryPreview } from "@/lib/recovery-personalization";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";

/** Prévia por aluno: quais indicadores (e blocos) cada estudante verá. Somente leitura. */
export function RecoveryPreview({ missionId, enabled }: { missionId: string; enabled: boolean }) {
  const { data, isLoading, error } = useRecoveryPreview(missionId, enabled);
  if (!enabled) return null;
  const byStudent = new Map<string, { name: string; rows: NonNullable<typeof data> }>();
  for (const r of data ?? []) {
    const e = byStudent.get(r.student_id) ?? { name: r.full_name ?? "Aluno", rows: [] };
    e.rows.push(r);
    byStudent.set(r.student_id, e);
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Prévia por aluno — blocos exibidos</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        PA/NA: bloco exibido · A: oculto · sem menção: oculto e requer revisão docente. O conjunto é congelado quando o
        aluno inicia a tentativa. Só aparecem alunos das turmas atribuídas (salve a missão após atribuir).
      </p>
      {isLoading ? <p className="text-xs text-muted-foreground">Carregando…</p> : null}
      {error ? <p className="text-xs text-danger">{(error as Error).message}</p> : null}
      {!isLoading && byStudent.size === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum aluno nas turmas atribuídas.</p>
      ) : null}
      <div className="space-y-2">
        {[...byStudent.entries()].map(([id, s]) => {
          const shown = s.rows.filter((r) => r.shown).map((r) => r.code);
          const review = s.rows.filter((r) => r.needs_review).map((r) => r.code);
          return (
            <div key={id} className="rounded-lg border border-border p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  {shown.length ? `Verá: ${shown.join(", ")}` : "Nenhum bloco de indicador"}
                  {review.length ? ` · ⚠ revisão: ${review.join(", ")}` : ""}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {s.rows.map((r) => (
                  <span key={r.code} className="flex items-center gap-1">
                    <span className="font-semibold text-primary">{r.code}</span>
                    <ConceptBadge concept={r.concept as Concept} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
