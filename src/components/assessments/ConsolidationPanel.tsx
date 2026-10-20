import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  consolidate,
  extractVotes,
  needsReview,
  STATUS_LABEL,
  useHomologate,
  useStudentConsolidation,
  type Concept,
  type Consolidation,
} from "@/lib/indicator-consolidation";

type Indicator = { id: string; code: string; description: string };

export function ConsolidationPanel({
  studentId,
  classId,
  indicators,
  instructorId,
}: {
  studentId: string;
  classId: string | null;
  indicators: Indicator[];
  instructorId: string | null;
}) {
  const { data, isLoading } = useStudentConsolidation(studentId, classId);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Consolidação por predominância (prévia)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sugestão calculada pela menção mais frequente nas missões avaliadas. A matriz oficial ainda não é alterada.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Calculando…</p>}
        {data &&
          indicators.map((ind) => {
            const votes = extractVotes(data.rows, studentId, ind.code);
            const matrix = data.matrix.get(ind.id) ?? null;
            const c = consolidate(votes, matrix, data.homs.get(ind.id) ?? null);
            const review = needsReview(c.status);
            return (
              <div
                key={ind.id}
                className={`rounded-lg border p-2 text-sm ${review ? "border-warning bg-warning/10" : "border-border"}`}
              >
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                  onClick={() => setOpen(open === ind.id ? null : ind.id)}
                >
                  <span className="font-medium">{ind.code}</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-muted-foreground">
                      A {c.counts.A} · PA {c.counts.PA} · NA {c.counts.NA}
                    </span>
                    <Badge variant="outline">Matriz: {matrix ?? "—"}</Badge>
                    <Badge variant={c.changesMatrix ? "default" : "secondary"}>
                      Sugestão: {c.effective ?? "—"}
                    </Badge>
                    <Badge variant={review ? "destructive" : "outline"}>{STATUS_LABEL[c.status]}</Badge>
                  </span>
                </button>
                {open === ind.id && (
                  <Detail
                    c={c}
                    indicatorId={ind.id}
                    classId={classId}
                    studentId={studentId}
                    instructorId={instructorId}
                    homReason={data.homs.get(ind.id)?.reason ?? null}
                  />
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}

function Detail({
  c,
  indicatorId,
  classId,
  studentId,
  instructorId,
  homReason,
}: {
  c: Consolidation;
  indicatorId: string;
  classId: string | null;
  studentId: string;
  instructorId: string | null;
  homReason: string | null;
}) {
  const [reason, setReason] = useState("");
  const hom = useHomologate(classId, studentId);

  const decide = (concept: Concept) => {
    if (!instructorId) return;
    const decision =
      c.mode === "tie" ? "tie_resolution" : c.status === "reduction_review" && concept === "A" ? "keep_A" : concept === c.mode ? "confirm_mode" : "override";
    hom.mutate(
      {
        indicatorId,
        concept,
        decision,
        reason,
        decidedBy: instructorId,
        basis: { counts: c.counts, mode: c.mode, votes: c.votes.map((v) => ({ m: v.missionId, v: v.version, c: v.concept })) },
      },
      {
        onSuccess: () => {
          toast.success("Decisão registrada.");
          setReason("");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      <ol className="space-y-1 text-xs">
        {c.votes.map((v) => (
          <li key={v.missionId} className="flex justify-between gap-2">
            <span>
              {new Date(v.date).toLocaleDateString("pt-BR")} · {v.missionTitle} (v{v.version})
              {v.individual && <span className="text-muted-foreground"> · diferenciação individual</span>}
            </span>
            <Badge variant="outline">{v.concept}</Badge>
          </li>
        ))}
        {c.votes.length === 0 && <li className="text-muted-foreground">Nenhuma missão avaliada.</li>}
      </ol>
      {homReason && <p className="text-xs text-muted-foreground">Justificativa vigente: {homReason}</p>}
      {instructorId && classId && (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Justificativa pedagógica (obrigatória, mínimo 10 caracteres)"
            className="text-xs"
          />
          <div className="flex flex-wrap gap-2">
            {(["A", "PA", "NA"] as Concept[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={k === c.mode ? "default" : "outline"}
                disabled={hom.isPending || reason.trim().length < 10}
                onClick={() => decide(k)}
              >
                Homologar {k}
                {k === c.mode ? " (predominante)" : ""}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
