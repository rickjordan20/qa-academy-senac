import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  CONCEPT_LABELS,
  STAGES,
  stageLabel,
  useAddFeedback,
  useDeleteFeedback,
  useEvalHistory,
  useFeedbacks,
  useStudentDossier,
  useUpsertEvaluation,
  type Concept,
  type EvaluationRow,
  type IndicatorRow,
  type Stage,
  type StudentInfo,
} from "@/lib/assessment";
import { ConceptBadge } from "@/components/ConceptBadge";
import { fmtDateTime, useIndicatorOrigins } from "@/lib/mission-submissions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { analyzeIndicatorHistory } from "@/lib/pedagogical-analysis.functions";
import { evidenceFingerprint } from "@/lib/pedagogical-analysis";
import { useStudentView } from "@/lib/student-view";

type AnalysisResult = Awaited<ReturnType<typeof analyzeIndicatorHistory>>;
const analysisCache = new Map<string, { fp: string; result: AnalysisResult }>();

function PedagogicalAnalysis(props: {
  classId: string;
  studentId: string;
  indicatorId: string;
  stage: Stage;
  fingerprint: string;
  onApply: (text: string) => void;
}) {
  const run = useServerFn(analyzeIndicatorHistory);
  const view = useStudentView();
  const key = `${props.classId}:${props.studentId}:${props.indicatorId}:${props.stage}`;
  const cached = analysisCache.get(key);
  const [result, setResult] = useState<AnalysisResult | null>(cached?.fp === props.fingerprint ? cached.result : null);
  const [text, setText] = useState(result && result.ok ? result.feedback : "");
  const [loading, setLoading] = useState(false);
  const stale = !!result && analysisCache.get(key)?.fp !== props.fingerprint;

  if (view) return null;

  async function generate() {
    setLoading(true);
    try {
      const r = await run({ data: { classId: props.classId, studentId: props.studentId, indicatorId: props.indicatorId, stage: props.stage } });
      analysisCache.set(key, { fp: props.fingerprint, result: r });
      setResult(r);
      setText(r.ok ? r.feedback : "");
      if (!r.ok) toast.error(r.error);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao gerar análise.");
    } finally {
      setLoading(false);
    }
  }

  if (!result)
    return (
      <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
        {loading ? "Analisando…" : "Analisar histórico e gerar feedback"}
      </Button>
    );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="font-semibold">Análise pedagógica – Indicador selecionado</div>
      {stale && <p className="text-xs text-destructive">As evidências mudaram desde esta análise. Gere novamente.</p>}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1">Matriz: <ConceptBadge concept={result.matrixConcept} /></span>
        <span>Predominância: A {result.counts.A} · PA {result.counts.PA} · NA {result.counts.NA} ({result.mode === "tie" ? "empate" : result.mode ?? "—"})</span>
        {result.homologation && <span>Homologação docente: {result.homologation.concept}</span>}
        {result.ok && (
          <span className="flex items-center gap-1">
            Sugestão pedagógica: {result.suggestedMention ? <ConceptBadge concept={result.suggestedMention} /> : "evidência insuficiente"}
          </span>
        )}
      </div>
      {result.ok ? (
        <>
          {result.aiUsed ? (
            <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          ) : (
            <p className="text-xs text-muted-foreground">Sem evidências suficientes para gerar feedback; a IA não foi acionada.</p>
          )}
          {result.sources.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">Evidências utilizadas</div>
              <ul className="list-disc pl-5 text-xs">
                {result.sources.map((s) => (
                  <li key={s.missionId}>{s.title} ({s.concept}) — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {result.limitations.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {result.limitations.map((l) => <li key={l}>{l}</li>)}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Sugestão apenas: nada é salvo e nenhuma menção muda até você confirmar abaixo. Modelo: {result.model}.
          </p>
        </>
      ) : (
        <p className="text-xs text-destructive">{result.error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {result.ok && result.aiUsed && (
          <Button size="sm" disabled={!text.trim()} onClick={() => { props.onApply(text.trim()); toast.success("Feedback aplicado (ainda não salvo)"); }}>
            Aplicar feedback
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          {loading ? "Analisando…" : "Gerar novamente"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { analysisCache.delete(key); setResult(null); setText(""); }}>
          Descartar
        </Button>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classId: string;
  student: StudentInfo;
  indicator: IndicatorRow;
  current: EvaluationRow | undefined;
  defaultStage?: Stage;
  /** Menções permitidas (padrão A/PA/NA). */
  concepts?: Concept[];
};

export function IndicatorDialog({
  open,
  onOpenChange,
  classId,
  student,
  indicator,
  current,
  defaultStage = "regular",
  concepts = ["A", "PA", "NA"],
}: Props) {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>(defaultStage);
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [feedback, setFeedback] = useState("");

  const { data: dossier } = useStudentDossier(open ? student.id : null);
  const { data: history } = useEvalHistory(open ? student.id : null);
  const { data: feedbacks } = useFeedbacks(open ? student.id : null);
  const { data: origins } = useIndicatorOrigins(open ? student.id : null);
  const upsert = useUpsertEvaluation(classId);
  const addFeedback = useAddFeedback();
  const delFeedback = useDeleteFeedback();

  const indHistory = (history ?? []).filter((h) => h.indicator_id === indicator.id);
  const indOrigins = (origins ?? []).filter((o) => !!o.indicator_finals?.[indicator.code]);
  const indFeedbacks = (feedbacks ?? []).filter(
    (f) => f.indicator_id === indicator.id || f.indicator_id === null,
  );

  async function evaluate(concept: Concept) {
    if (!user) return;
    if (current?.concept && current.concept !== concept && !notes.trim()) {
      toast.error("Justifique a alteração da menção nas observações antes de salvar.");
      return;
    }
    try {
      await upsert.mutateAsync({
        studentId: student.id,
        indicatorId: indicator.id,
        concept,
        stage,
        notes,
        evaluatedBy: user.id,
      });
      toast.success(`${indicator.code}: ${concept} registrado`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {indicator.code} · {student.full_name || student.email}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{indicator.description}</p>

        <Tabs defaultValue="avaliar">
          <TabsList className="flex-wrap">
            <TabsTrigger value="avaliar">Avaliação</TabsTrigger>
            <TabsTrigger value="techeduca">TechEduca</TabsTrigger>
            <TabsTrigger value="cafe">Café Central</TabsTrigger>
            <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
            <TabsTrigger value="origem">Origem</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="avaliar" className="space-y-4 pt-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Menção atual:</span>
              <ConceptBadge concept={current?.concept ?? null} />
              {current?.stage && (
                <span className="text-xs text-muted-foreground">({stageLabel(current.stage)})</span>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Etapa
              </label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <Button
                    key={s.value}
                    size="sm"
                    variant={stage === s.value ? "default" : "outline"}
                    onClick={() => setStage(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <PedagogicalAnalysis
              classId={classId}
              studentId={student.id}
              indicatorId={indicator.id}
              stage={stage}
              fingerprint={evidenceFingerprint([current, indHistory, indFeedbacks, origins?.map((o) => [o.id, o.is_current, o.version, o.member_overrides])])}
              onApply={(t) => setNotes(t)}
            />
            <Textarea
              placeholder="Observações da avaliação"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {concepts.map((c) => (
                <Button key={c} onClick={() => evaluate(c)} disabled={upsert.isPending}>
                  {c} – {CONCEPT_LABELS[c]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Cada avaliação registrada é guardada no histórico; a anterior nunca é apagada.
              {" Menções A, PA ou NA valem em qualquer etapa, inclusive após a recuperação. Alterar a menção exige justificativa."}
            </p>
          </TabsContent>

          <TabsContent value="techeduca" className="space-y-3 pt-4 text-sm">
            <Section title="Evidências individuais">
              {(dossier?.teEvidences ?? []).map((e) => (
                <Row key={e.id} title={e.title} sub={e.description ?? ""} />
              ))}
              {(dossier?.qaEvidences ?? [])
                .filter((e) => e.context === "techeduca")
                .map((e) => (
                  <Row key={e.id} title={e.title} sub={e.kind} />
                ))}
            </Section>
            <Section title="Registros de bugs (TechEduca)">
              {(dossier?.teBugs ?? []).map((b) => (
                <Row key={b.id} title={b.feature} sub={`${b.classification} · ${b.problem}`} />
              ))}
            </Section>
          </TabsContent>

          <TabsContent value="cafe" className="space-y-3 pt-4 text-sm">
            <Section title="Contribuições individuais">
              {(dossier?.contributions ?? []).map((c) => (
                <Row key={c.id} title={c.title} sub={c.kind} />
              ))}
            </Section>
            <Section title="Evidências coletivas relacionadas">
              {(dossier?.qaEvidences ?? [])
                .filter((e) => e.context === "cafe")
                .map((e) => (
                  <Row key={e.id} title={e.title} sub={e.kind} />
                ))}
            </Section>
            <Section title="Tarefas do grupo">
              {(dossier?.tasks ?? []).map((t) => (
                <Row key={t.id} title={t.title} sub={`${t.area} · ${t.status}`} />
              ))}
            </Section>
          </TabsContent>

          <TabsContent value="feedbacks" className="space-y-3 pt-4">
            <Textarea
              placeholder="Escreva um feedback para este indicador"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!feedback.trim() || !user}
              onClick={async () => {
                await addFeedback.mutateAsync({
                  classId,
                  studentId: student.id,
                  indicatorId: indicator.id,
                  message: feedback.trim(),
                  authorId: user!.id,
                });
                setFeedback("");
                toast.success("Feedback registrado");
              }}
            >
              Adicionar feedback
            </Button>
            <div className="space-y-2">
              {indFeedbacks.map((f) => (
                <div key={f.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p>{f.message}</p>
                    <Button size="sm" variant="ghost" onClick={() => delFeedback.mutate(f.id)}>
                      Remover
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
              {indFeedbacks.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum feedback ainda.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="origem" className="space-y-2 pt-4">
            {indOrigins.map((o) => (
              <div key={o.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Missão: {o.missionTitle}</span>
                  <ConceptBadge concept={(o.indicator_finals?.[indicator.code] ?? null) as never} />
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {(o.block_results ?? [])
                    .filter((b) => b.indicators?.[indicator.code])
                    .map((b) => (
                      <p key={b.section_id}>
                        Bloco: {b.title} — resultado {b.indicators[indicator.code]}
                        {b.comment ? ` · ${b.comment}` : ""}
                      </p>
                    ))}
                  <p>
                    Menção consolidada da missão: {o.indicator_finals?.[indicator.code]} ·{" "}
                    {o.is_current ? "avaliação vigente" : "avaliação anterior"} · {fmtDateTime(o.created_at)}
                  </p>
                </div>
              </div>
            ))}
            {indOrigins.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma menção deste indicador veio de avaliação de missão.
              </p>
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-2 pt-4">
            {indHistory.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <ConceptBadge concept={h.concept} />
                  <span className="text-xs text-muted-foreground">{stageLabel(h.stage)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </span>
                {h.notes && <p className="w-full text-xs text-muted-foreground">{h.notes}</p>}
              </div>
            ))}
            {indHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem histórico para este indicador.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = !children || (Array.isArray(children) && children.flat().length === 0);
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">{title}</h3>
      <div className="space-y-2">
        {empty ? <p className="text-sm text-muted-foreground">Nenhum registro.</p> : children}
      </div>
    </div>
  );
}

function Row({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="font-medium">{title}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
