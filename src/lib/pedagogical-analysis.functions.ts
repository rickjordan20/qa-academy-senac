import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAnalysisContext, sanitizeAnswer, type AiAnswer, type SourceEval } from "@/lib/pedagogical-analysis";
import type { Concept, Homologation } from "@/lib/indicator-consolidation";

const MODEL = "google/gemini-3.1-flash-lite";
const UUID = /^[0-9a-f-]{36}$/i;

const SYSTEM = `Você é um docente avaliador do SENAC (UC10, QA). Escreva em português brasileiro, dirigindo-se diretamente ao estudante ("você"), com tom acolhedor, objetivo e profissional.
Regras: use SOMENTE os dados fornecidos; não invente missões, entregas ou resultados; não atribua competências sem evidência; reconheça avanços e esforço; aponte dificuldades sem exagero; justifique pedagogicamente a menção sugerida; avaliação formativa e justa. Diferenciação individual prevalece sobre a menção do grupo. Interprete qualitativamente comentários dos blocos e feedbacks, não só contagens.
Feedback com 80 a 140 palavras (menos se houver pouca evidência). Se a evidência for insuficiente, suggested_mention = null e diga isso no texto.
Em evidence_used cite apenas mission_id existentes no contexto. Responda em JSON.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggested_mention", "feedback", "evidence_used", "limitations"],
  properties: {
    suggested_mention: { type: ["string", "null"], enum: ["A", "PA", "NA", null] },
    feedback: { type: "string" },
    evidence_used: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["mission_id", "reason"],
        properties: { mission_id: { type: "string" }, reason: { type: "string" } },
      },
    },
    limitations: { type: "array", items: { type: "string" } },
  },
};

export const analyzeIndicatorHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId: string; studentId: string; indicatorId: string; stage: string }) => {
    if (![d?.classId, d?.studentId, d?.indicatorId].every((v) => typeof v === "string" && UUID.test(v)))
      throw new Error("Parâmetros inválidos.");
    if (!["regular", "final", "recuperacao"].includes(d.stage)) throw new Error("Etapa inválida.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Autorização no servidor (não confia no frontend)
    const [instr, view, enr, ind] = await Promise.all([
      supabase.rpc("is_class_instructor", { _class_id: data.classId, _user_id: userId }),
      supabase.rpc("in_student_view" as never, { _user_id: userId } as never),
      supabase.from("enrollments").select("id").eq("class_id", data.classId).eq("student_id", data.studentId).maybeSingle(),
      supabase.from("indicators").select("id, code, description, uc_code").eq("id", data.indicatorId).maybeSingle(),
    ]);
    if (instr.error || instr.data !== true) throw new Error("Apenas o instrutor da turma pode gerar a análise.");
    if (view.error || view.data === true) throw new Error("Indisponível no modo \"Ver como aluno\".");
    if (!enr.data) throw new Error("Estudante não matriculado nesta turma.");
    if (!ind.data || ind.data.uc_code !== "UC10") throw new Error("Indicador não pertence à UC10.");

    // Evidências carregadas no servidor: somente versões vigentes e definitivas
    const [evRes, matRes, homRes, fbRes, hiRes] = await Promise.all([
      supabase
        .from("builder_run_evaluations")
        .select("id, mission_id, version, created_at, indicator_finals, member_overrides, target_student_ids, feedback, block_results, override_notes, builder_mission_runs!inner(eval_status), builder_missions(title)")
        .eq("is_current", true)
        .eq("builder_mission_runs.eval_status", "evaluated")
        .contains("target_student_ids", [data.studentId]),
      supabase.from("indicator_evaluations").select("concept").eq("class_id", data.classId).eq("student_id", data.studentId).eq("indicator_id", data.indicatorId).maybeSingle(),
      supabase.from("indicator_homologations").select("id, concept, decision, reason, decided_at").eq("class_id", data.classId).eq("student_id", data.studentId).eq("indicator_id", data.indicatorId).eq("is_current", true).maybeSingle(),
      supabase.from("eval_feedbacks").select("message, created_at").eq("student_id", data.studentId).eq("indicator_id", data.indicatorId).order("created_at", { ascending: false }).limit(5),
      supabase.from("eval_history").select("concept, stage, notes, created_at").eq("student_id", data.studentId).eq("indicator_id", data.indicatorId).order("created_at", { ascending: false }).limit(5),
    ]);
    for (const r of [evRes, matRes, homRes, fbRes, hiRes]) if (r.error) throw new Error("Falha ao carregar evidências.");

    const evals = (evRes.data ?? []).map((r) => {
      const row = r as unknown as SourceEval & { builder_missions: { title: string } | null };
      return { ...row, missionTitle: row.builder_missions?.title ?? "Missão" };
    });
    const ctx = buildAnalysisContext({
      studentId: data.studentId,
      indicatorCode: ind.data.code,
      indicatorDescription: ind.data.description,
      stage: data.stage,
      evals,
      matrixConcept: (matRes.data?.concept as Concept | null) ?? null,
      homologation: (homRes.data as unknown as Homologation | null) ?? null,
      feedbacks: fbRes.data ?? [],
      history: hiRes.data ?? [],
    });

    const base = { model: MODEL, matrixConcept: ctx.matrixConcept, counts: ctx.counts, mode: ctx.mode, status: ctx.status, homologation: ctx.homologation };

    // Sem evidência: não gasta IA
    if (!ctx.sufficient && ctx.feedbacks.length === 0) {
      return { ...base, ok: true as const, suggestedMention: null, feedback: "", sources: [], limitations: ctx.limitations, aiUsed: false };
    }

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ...base, ok: false as const, error: "Serviço de IA não configurado." };

    const { limitations: _l, sufficient: _s, ...payload } = ctx;
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Contexto (json):\n${JSON.stringify(payload)}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "analise", strict: true, schema: SCHEMA } },
        }),
      });
    } catch {
      return { ...base, ok: false as const, error: "Sem conexão com o serviço de IA. Tente novamente em instantes." };
    }
    if (!res.ok) {
      const msg =
        res.status === 429 ? "Muitas solicitações. Aguarde alguns segundos e tente novamente."
        : res.status === 402 ? "Créditos de IA insuficientes no workspace."
        : res.status === 403 ? "Uso de IA bloqueado pelas configurações do workspace."
        : "Serviço de IA indisponível no momento.";
      console.error("AI gateway", res.status, await res.text().catch(() => ""));
      return { ...base, ok: false as const, error: msg };
    }
    try {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "") as AiAnswer;
      const clean = sanitizeAnswer(parsed, ctx);
      if (!clean.feedback) throw new Error("vazio");
      return { ...base, ok: true as const, ...clean, aiUsed: true };
    } catch {
      return { ...base, ok: false as const, error: "A IA retornou uma resposta inválida. Tente gerar novamente." };
    }
  });
