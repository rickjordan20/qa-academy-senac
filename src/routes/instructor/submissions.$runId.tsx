import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useIndicators } from "@/lib/uc10";
import { blockDef, type Section } from "@/lib/mission-builder";
import { SubmissionDetail } from "@/routes/student/missions.$runId";
import {
  answerSummary,
  fmtDateTime,
  suggestConcept,
  useEvaluateSubmission,
  useIndicatorResults,
  useRunEvaluations,
  useSubmission,
  type BlockResult,
} from "@/lib/mission-submissions";

export const Route = createFileRoute("/instructor/submissions/$runId")({
  head: () => ({
    meta: [
      { title: "Ficha de avaliação | QA Academy" },
      { name: "description", content: "Avalie o envio da missão bloco a bloco: respostas, evidências, indicadores I1-I6 e XP." },
      { property: "og:title", content: "Ficha de avaliação | QA Academy" },
      { property: "og:description", content: "Avaliação detalhada de um envio de missão da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluatePage,
});

const CONCEPTS = ["A", "PA", "NA"] as const;

function ConceptPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {CONCEPTS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(value === c ? "" : c)}
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${
            value === c ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function EvaluatePage() {
  const { runId } = Route.useParams();
  const { user } = useAuth();
  const { data } = useSubmission(runId);
  const { data: indicators } = useIndicators();
  const { data: history } = useRunEvaluations(runId);
  const run = data?.run ?? null;
  const members = data?.members ?? [];
  const entries = data?.entries ?? [];
  const { data: current } = useIndicatorResults(run?.classId ?? null, run?.student_id ?? null);
  const evaluate = useEvaluateSubmission();

  const [xp, setXp] = useState("");
  const [feedback, setFeedback] = useState("");
  const [blockConcepts, setBlockConcepts] = useState<Record<string, Record<string, string>>>({});
  const [blockComments, setBlockComments] = useState<Record<string, string>>({});
  const [finals, setFinals] = useState<Record<string, string>>({});
  const hydrated = useState<{ id: string | null }>({ id: null })[0];

  const sections = useMemo(() => ((run?.mission?.sections ?? []) as Section[]).filter((s) => s.visible !== false), [run]);
  const indList = indicators ?? [];
  const byCode = useMemo(
    () => new Map(indList.map((i) => [i.code, i as { id: string; code: string; description: string }])),
    [indList],
  );
  const answers = useMemo(() => answerSummary(sections, run?.answers ?? {}), [sections, run]);
  const answersBySection = useMemo(() => new Map(answers.map((a) => [a.section.id, a.pairs])), [answers]);

  const evaluatedBlocks = useMemo(
    () => sections.filter((s) => (s.indicator_codes ?? []).length > 0),
    [sections],
  );

  const previous = history?.[0] ?? null;
  const alreadyEvaluated = run?.eval_status === "evaluated" || (history ?? []).some((h) => h.is_current);

  // hidratação inicial (a partir da avaliação anterior, quando houver)
  useEffect(() => {
    if (!run || hydrated.id === run.id) return;
    hydrated.id = run.id;
    setXp(String(run.xp_awarded ?? run.mission?.base_xp ?? 0));
    setFeedback(run.feedback ?? "");
    if (previous) {
      const bc: Record<string, Record<string, string>> = {};
      const cm: Record<string, string> = {};
      for (const b of previous.block_results ?? []) {
        bc[b.section_id] = b.indicators ?? {};
        cm[b.section_id] = b.comment ?? "";
      }
      setBlockConcepts(bc);
      setBlockComments(cm);
      setFinals({ ...(previous.indicator_finals ?? {}) });
    }
  }, [run, previous, hydrated]);

  // menções já registradas na matriz (envio individual) como ponto de partida
  useEffect(() => {
    if (!current || !indList.length) return;
    setFinals((prev) => {
      const next = { ...prev };
      for (const ind of indList) {
        const c = current[ind.id];
        if (c && !next[ind.code]) next[ind.code] = c;
      }
      return next;
    });
  }, [current, indList]);

  // consolidação: código -> avaliações por bloco
  const consolidation = useMemo(() => {
    const map = new Map<string, { sectionTitle: string; concept: string }[]>();
    for (const s of evaluatedBlocks) {
      for (const code of s.indicator_codes ?? []) {
        const concept = blockConcepts[s.id]?.[code] ?? "";
        const list = map.get(code) ?? [];
        list.push({ sectionTitle: s.title, concept });
        map.set(code, list);
      }
    }
    return [...map.entries()];
  }, [evaluatedBlocks, blockConcepts]);

  function setBlockConcept(sectionId: string, code: string, value: string) {
    setBlockConcepts((prev) => ({ ...prev, [sectionId]: { ...(prev[sectionId] ?? {}), [code]: value } }));
  }

  async function submit(decision: "draft" | "evaluated" | "revision") {
    if (!run || !user) return;
    const blocks: BlockResult[] = evaluatedBlocks.map((s) => ({
      section_id: s.id,
      title: s.title,
      comment: blockComments[s.id] ?? "",
      indicators: Object.fromEntries(
        (s.indicator_codes ?? []).map((c) => [c, blockConcepts[s.id]?.[c] ?? ""]).filter(([, v]) => v),
      ) as Record<string, string>,
    }));

    const indicatorIdByCode: Record<string, string> = {};
    const indicatorMap: Record<string, string> = {};
    for (const [code, concept] of Object.entries(finals)) {
      const ind = byCode.get(code);
      if (!ind || !concept) continue;
      indicatorIdByCode[code] = ind.id;
      indicatorMap[ind.id] = concept;
    }

    try {
      await evaluate.mutateAsync({
        run,
        instructorId: user.id,
        decision,
        xp: Number(xp) || 0,
        feedback,
        indicators: indicatorMap,
        indicatorIdByCode,
        blocks,
        members: members.map((m) => ({ id: m.id, name: m.name })),
      });
      toast.success(
        decision === "evaluated"
          ? "Avaliação registrada. Menções lançadas na Matriz de Avaliação."
          : decision === "revision"
            ? "Revisão solicitada ao aluno."
            : "Rascunho da avaliação salvo.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <SubmissionDetail
        runId={runId}
        backTo={
          <Link to="/instructor/submissions" className="text-xs text-muted-foreground hover:underline">
            ← Central de avaliação
          </Link>
        }
      />

      {run ? (
        <div className="max-w-4xl space-y-5">
          {alreadyEvaluated ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              Esta entrega possui uma avaliação anterior. A nova avaliação será considerada a avaliação vigente,
              mantendo a anterior no histórico.
            </div>
          ) : null}

          {run.group_id ? (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
              Esta é uma entrega em grupo. As menções atribuídas aos indicadores serão registradas para todos os
              integrantes do grupo{members.length ? `: ${members.map((m) => m.name).join(", ")}.` : "."}
            </div>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Avaliação por bloco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {evaluatedBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum bloco desta missão possui indicadores associados. Associe indicadores aos blocos na edição da
                  missão ou defina as menções na Consolidação abaixo.
                </p>
              ) : null}
              {evaluatedBlocks.map((s) => {
                const pairs = answersBySection.get(s.id) ?? [];
                const blockEntries = entries.filter((e) => e.section_id === s.id);
                return (
                  <div key={s.id} className="rounded-lg border border-border p-3">
                    <p className="font-semibold">
                      {blockDef(s.kind).icon} {s.title}
                    </p>

                    <div className="mt-2 space-y-2 text-sm">
                      {pairs.map((p) => (
                        <div key={p.label}>
                          <p className="text-xs font-semibold text-muted-foreground">{p.label}</p>
                          <p className="whitespace-pre-wrap">{p.value}</p>
                        </div>
                      ))}
                      {blockEntries.map((e) => (
                        <div key={e.id} className="rounded-md border border-border/70 bg-surface p-2 text-xs">
                          <p className="font-semibold">
                            {blockDef(e.kind).icon} {e.title || blockDef(e.kind).label}
                          </p>
                          {Object.entries(e.data ?? {})
                            .filter(([, v]) => (v ?? "").toString().trim())
                            .map(([k, v]) => (
                              <p key={k}>
                                <span className="text-muted-foreground">{k}: </span>
                                {v}
                              </p>
                            ))}
                          {e.link ? (
                            <a
                              href={e.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline"
                            >
                              🔗 Abrir evidência
                            </a>
                          ) : null}
                        </div>
                      ))}
                      {pairs.length === 0 && blockEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem registros neste bloco.</p>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted-foreground">Indicadores deste bloco</p>
                      {(s.indicator_codes ?? []).map((code) => {
                        const ind = byCode.get(code);
                        return (
                          <div key={code} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm">
                              <span className="font-semibold">{code}</span>
                              {ind ? ` — ${ind.description}` : ""}
                            </span>
                            <ConceptPicker
                              value={blockConcepts[s.id]?.[code]}
                              onChange={(v) => setBlockConcept(s.id, code, v)}
                            />
                          </div>
                        );
                      })}
                      <Textarea
                        rows={2}
                        placeholder="Comentário deste bloco (opcional)"
                        value={blockComments[s.id] ?? ""}
                        onChange={(e) => setBlockComments((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Consolidação dos Indicadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {consolidation.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem indicadores associados aos blocos. Nenhuma menção será lançada automaticamente.
                </p>
              ) : null}
              {consolidation.map(([code, results]) => {
                const ind = byCode.get(code);
                const suggestion = suggestConcept(results.map((r) => r.concept));
                return (
                  <div key={code} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">
                      {code}
                      {ind ? ` — ${ind.description}` : ""}
                    </p>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {results.map((r, idx) => (
                        <p key={`${r.sectionTitle}-${idx}`}>
                          {r.sectionTitle}: {r.concept || "—"}
                        </p>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Menção final do indicador{suggestion ? ` · sugestão: ${suggestion}` : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        {suggestion && finals[code] !== suggestion ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFinals((p) => ({ ...p, [code]: suggestion }))}
                          >
                            Usar sugestão
                          </Button>
                        ) : null}
                        <ConceptPicker
                          value={finals[code]}
                          onChange={(v) => setFinals((p) => ({ ...p, [code]: v }))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                A decisão final é sempre do instrutor. As menções confirmadas aqui são lançadas na Matriz de Avaliação
                ao concluir.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">XP e feedback geral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <label className="text-xs font-semibold text-muted-foreground">XP a conceder</label>
                <Input type="number" min={0} value={xp} onChange={(e) => setXp(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  XP base da missão: {run.mission?.base_xp ?? 0}. O XP não define A/PA/NA.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Feedback para o aluno</label>
                <Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={evaluate.isPending} onClick={() => submit("evaluated")}>
                  {alreadyEvaluated ? "Concluir reavaliação" : "Concluir avaliação"}
                </Button>
                <Button variant="outline" disabled={evaluate.isPending} onClick={() => submit("draft")}>
                  Salvar rascunho
                </Button>
                <Button variant="outline" disabled={evaluate.isPending} onClick={() => submit("revision")}>
                  Solicitar revisão
                </Button>
              </div>
            </CardContent>
          </Card>

          {(history ?? []).length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico de avaliações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(history ?? []).map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-3">
                    <p className="font-semibold">
                      {h.version === 1 ? "Avaliação original" : `Reavaliação ${h.version - 1}`}
                      {h.is_current ? " · vigente" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(h.created_at)} · XP {h.xp ?? 0}
                    </p>
                    {h.feedback ? <p className="mt-1 whitespace-pre-wrap text-xs">{h.feedback}</p> : null}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {Object.entries(h.indicator_finals ?? {}).map(([code, c]) => (
                        <span key={code} className="mr-2">
                          {code}: {c}
                        </span>
                      ))}
                    </div>
                    {(h.block_results ?? []).map((b) => (
                      <p key={b.section_id} className="mt-1 text-xs">
                        <span className="text-muted-foreground">{b.title}: </span>
                        {Object.entries(b.indicators ?? {})
                          .map(([code, c]) => `${code} ${c}`)
                          .join(" · ") || "—"}
                        {b.comment ? ` — ${b.comment}` : ""}
                      </p>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
