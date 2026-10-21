import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  missionXpCap,
  sanitizeEvaluation,
  scopeBlocksToTarget,
  oversizedStatements,
  type AiAnswer,
  type CtxBlock,
  type CtxMember,
  type EvalContext,
} from "@/lib/mission-ai-evaluation";

const MODEL = "google/gemini-3.1-flash-lite";
const UUID = /^[0-9a-f-]{36}$/i;
const HIDDEN = new Set(["id", "section_id", "parent_id", "feature_id"]);

const SYSTEM = `Você é um docente avaliador do SENAC (UC10, Qualidade de Software). Avalie a entrega de uma missão BLOCO A BLOCO, em português brasileiro, falando diretamente ao estudante ("você"), com tom justo, flexível, acolhedor e fundamentado.
PROCEDIMENTO OBRIGATÓRIO (nesta ordem):
1. INTERPRETAR O ENUNCIADO de cada bloco antes de ler respostas: título/objetivo da missão, description, instructions (enunciado completo), questions (perguntas com id e obrigatoriedade), códigos, exemplos, dados, quantidades mínimas e CRITÉRIO DE CORREÇÃO do próprio enunciado. Distinga requisitos obrigatórios, exemplos ilustrativos, orientações e atividades opcionais (required=false) ou supervisionadas.
2. ANALISAR CADA QUESTÃO/REGISTRO SEPARADAMENTE: o que foi pedido, a resposta correspondente, acertos, erros técnicos comprovados, acertos parciais, requisitos não atendidos. Diferencie ausência de resposta, resposta incompleta e resposta incorreta. Verifique todos os campos, registros e anexos antes de afirmar ausência de evidência.
3. SÓ ENTÃO consolidar a menção (A, PA ou NA) de cada indicador do bloco, com justificativa objetiva baseada no critério do enunciado.
4. Por último, general_feedback, coerente com as menções dos blocos.
Regras:
- Use SOMENTE os dados fornecidos. Não invente respostas, entregas, resultados, participações, arquivos, funções, critérios ou exigências que não constem do enunciado. Não considere erro algo que não foi solicitado.
- Código no enunciado: use EXATAMENTE o código fornecido no bloco como referência (é didático, não é o código da QA Academy). Avalie a cobertura dos caminhos/condições que o enunciado pede. Não exija outros arquivos, funções ou acesso ao código da plataforma.
- Não afirme que um teste foi executado se houver só descrição teórica, salvo se o enunciado aceitar.
- Bloco opcional ou supervisionado (required=false) sem registros: mention = null, needs_review = true; nunca NA punitivo e nunca A automático.
- Postura justa e flexível: valorize evidências reais de aprendizagem; não penalize pequenas falhas de redação/formatação que não comprometam a competência; não exija perfeição. Não atribua A ou PA sem evidência mínima.
- Se não houver evidência suficiente, mention = null e needs_review = true (revisão docente necessária).
- Para cada bloco avalie apenas os indicadores listados nele.
- XP do bloco entre 0 e xp_max do bloco, proporcional à qualidade.
- feedback do bloco: 30 a 100 palavras, específico (acertos e o que melhorar, citando as questões). general_feedback: 60 a 160 palavras, individualizado, acolhedor e profissional, sem requisitos inexistentes e sem contradizer os blocos.
- Missão em grupo: avalie a entrega coletiva. NÃO trate ausência de registros no Kanban/tarefas como ausência de participação; considere todas as evidências (registros, contribuições, tarefas). Só sugira member_overrides quando houver evidência clara e diferente para o integrante; se não for possível distinguir contribuições, NÃO sugira override e registre um alerta pedindo revisão docente.
- evidence_used: cite títulos/rótulos reais dos registros ou respostas usados.
Responda em JSON.`;

const RECOVERY = (codes: string[]) => `RECUPERAÇÃO INDIVIDUAL: este estudante recebeu SOMENTE os blocos dos indicadores ${codes.join(", ")} (pendentes em PA/NA). Os demais indicadores já foram atendidos e NÃO fazem parte desta tentativa.
- Avalie e comente exclusivamente ${codes.join(", ")}. Não cite, não cobre e não atribua menção a nenhum outro indicador.
- Não afirme que o estudante deixou de fazer atividades que não lhe foram disponibilizadas.
- general_feedback: reconheça acertos e avanços nesses indicadores, aponte dificuldades reais e orientações de melhoria, com linguagem acolhedora e individualizada.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["blocks", "general_feedback", "member_overrides", "alerts"],
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section_id", "indicators", "xp", "feedback", "evidence_used", "needs_review", "alerts"],
        properties: {
          section_id: { type: "string" },
          indicators: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["code", "mention", "justification"],
              properties: {
                code: { type: "string" },
                mention: { type: ["string", "null"], enum: ["A", "PA", "NA", null] },
                justification: { type: "string" },
              },
            },
          },
          xp: { type: "integer" },
          feedback: { type: "string" },
          evidence_used: { type: "array", items: { type: "string" } },
          needs_review: { type: "boolean" },
          alerts: { type: "array", items: { type: "string" } },
        },
      },
    },
    general_feedback: { type: "string" },
    member_overrides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["student_id", "code", "mention", "reason"],
        properties: {
          student_id: { type: "string" },
          code: { type: "string" },
          mention: { type: "string", enum: ["A", "PA", "NA"] },
          reason: { type: "string" },
        },
      },
    },
    alerts: { type: "array", items: { type: "string" } },
  },
};

type Sec = {
  id: string;
  kind: string;
  title: string;
  description?: string;
  body?: string;
  visible?: boolean;
  xp?: number;
  required?: boolean;
  indicator_codes?: string[];
  items?: { id: string; label?: string; key?: string; required?: boolean }[];
  reportFields?: { id: string; key?: string; label?: string }[];
};

const short = (v: unknown, n = 1200) => String(v ?? "").trim().slice(0, n);

/** Somente leitura: nenhuma escrita no banco. */
export const evaluateMissionWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { runId: string }) => {
    if (typeof d?.runId !== "string" || !UUID.test(d.runId)) throw new Error("Entrega inválida.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const runRes = await supabase
      .from("builder_mission_runs")
      .select("id, mission_id, student_id, group_id, answers, submitted_at, eval_status, target_indicator_codes, builder_missions(*)")
      .eq("id", data.runId)
      .maybeSingle();
    if (runRes.error || !runRes.data) throw new Error("Entrega não encontrada.");
    const run = runRes.data as unknown as {
      id: string; mission_id: string; student_id: string | null; group_id: string | null;
      answers: Record<string, Record<string, unknown>> | null; submitted_at: string | null;
      target_indicator_codes: string[] | null;
      builder_missions: { title: string; objective: string; description: string; base_xp: number; sections: Sec[]; personalize_by_pending_indicators?: boolean } | null;
    };
    if (!run.builder_missions) throw new Error("Missão vinculada não encontrada.");
    if (!run.submitted_at) throw new Error("Esta entrega ainda não foi enviada para avaliação.");

    // Turma: do grupo ou da matrícula do estudante
    let classId: string | null = null;
    let members: { id: string; role: string }[] = [];
    if (run.group_id) {
      const [g, gm] = await Promise.all([
        supabase.from("groups").select("class_id").eq("id", run.group_id).maybeSingle(),
        supabase.from("group_members").select("student_id, member_function").eq("group_id", run.group_id),
      ]);
      classId = (g.data as { class_id: string } | null)?.class_id ?? null;
      members = ((gm.data ?? []) as { student_id: string; member_function: string | null }[]).map((m) => ({ id: m.student_id, role: m.member_function ?? "" }));
    } else if (run.student_id) {
      const e = await supabase.from("enrollments").select("class_id").eq("student_id", run.student_id).limit(1).maybeSingle();
      classId = (e.data as { class_id: string } | null)?.class_id ?? null;
    }
    if (!classId) throw new Error("Turma da entrega não identificada.");

    const [instr, view] = await Promise.all([
      supabase.rpc("is_class_instructor", { _class_id: classId, _user_id: userId }),
      supabase.rpc("in_student_view" as never, { _user_id: userId } as never),
    ]);
    if (instr.error || instr.data !== true) throw new Error("Apenas o instrutor da turma pode usar a avaliação com IA.");
    if (view.error || view.data === true) throw new Error('Indisponível no modo "Ver como aluno".');

    // Evidências carregadas no servidor (não confia no navegador)
    const ids = [...new Set([run.student_id, ...members.map((m) => m.id)].filter(Boolean) as string[])];
    const [entRes, indRes, profRes, taskRes, contribRes] = await Promise.all([
      supabase.from("builder_mission_entries").select("id, section_id, kind, title, author_id, data, link").eq("run_id", run.id),
      supabase.from("indicators").select("code, description, uc_code"),
      ids.length ? supabase.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [], error: null }),
      run.group_id ? supabase.from("cafe_tasks").select("assignee_id, status").eq("builder_run_id", run.id) : Promise.resolve({ data: [], error: null }),
      run.group_id ? supabase.from("cafe_contributions").select("student_id").eq("builder_run_id", run.id) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [entRes, indRes, profRes]) if (r.error) throw new Error("Falha ao carregar a entrega.");
    const names = new Map(((profRes.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p.full_name?.trim() || p.email]));
    const entries = (entRes.data ?? []) as { id: string; section_id: string; kind: string; title: string; author_id: string; data: Record<string, unknown> | null; link: string | null }[];

    // Recuperação personalizada: usa o conjunto CONGELADO da tentativa (nunca recalcula pela matriz atual).
    const target = run.builder_missions.personalize_by_pending_indicators ? (run.target_indicator_codes ?? []) : null;
    const sections = scopeBlocksToTarget(
      (run.builder_missions.sections ?? []).filter((s) => s.visible !== false && (s.indicator_codes ?? []).length > 0),
      target,
    );
    const tooLong = oversizedStatements(sections);
    if (tooLong.length) {
      return { ok: false as const, error: `Enunciado longo demais para análise fundamentada (${tooLong.join("; ")}). Avalie manualmente ou reduza o enunciado.` };
    }
    const blocks: CtxBlock[] = sections.map((s) => {
      const labels = new Map<string, string>();
      for (const it of [...(s.items ?? []), ...(s.reportFields ?? [])]) {
        labels.set(it.id, it.label ?? it.id);
        if (it.key) labels.set(it.key, it.label ?? it.key);
      }
      const ans = run.answers?.[s.id] ?? {};
      return {
        section_id: s.id,
        title: s.title,
        kind: s.kind,
        // Enunciado completo (limite verificado antes; nunca truncado em silêncio)
        description: String(s.description ?? "").trim(),
        instructions: String(s.body ?? "").trim(),
        indicator_codes: s.indicator_codes ?? [],
        required: s.required !== false,
        questions: (s.items ?? []).map((it) => ({ id: it.id, label: String(it.label ?? it.id), required: it.required !== false })),
        xp_max: Math.max(0, Number(s.xp) || 0),
        answers: Object.entries(ans)
          .map(([k, v]) => ({ label: labels.get(k) ?? k, value: short(v) }))
          .filter((a) => a.value),
        entries: entries
          .filter((e) => e.section_id === s.id)
          .slice(0, 25)
          .map((e) => ({
            title: e.title || e.kind,
            kind: e.kind,
            author: run.group_id ? names.get(e.author_id) ?? null : null,
            link: e.link,
            data: Object.fromEntries(
              Object.entries(e.data ?? {})
                .filter(([k, v]) => !HIDDEN.has(k) && String(v ?? "").trim())
                .map(([k, v]) => [k, short(v, 400)]),
            ),
          })),
      };
    });

    let group: EvalContext["group"] = null;
    if (run.group_id) {
      const tasks = (taskRes.data ?? []) as { assignee_id: string | null; status: string }[];
      const contribs = (contribRes.data ?? []) as unknown as { student_id: string }[];
      const list: CtxMember[] = members.map((m) => ({
        id: m.id,
        name: names.get(m.id) ?? "Integrante",
        role: m.role,
        tasks_assigned: tasks.filter((t) => t.assignee_id === m.id).length,
        tasks_done: tasks.filter((t) => t.assignee_id === m.id && t.status === "done").length,
        contributions: contribs.filter((c) => c.student_id === m.id).length,
        entries: entries.filter((e) => e.author_id === m.id).length,
      }));
      group = { members: list };
    }

    const codes = new Set(blocks.flatMap((b) => b.indicator_codes));
    const ctx: EvalContext = {
      mission: {
        title: run.builder_missions.title,
        objective: short(run.builder_missions.objective, 800),
        description: short(run.builder_missions.description, 800),
        base_xp: Number(run.builder_missions.base_xp) || 0,
        xp_cap: missionXpCap(run.builder_missions.base_xp, sections.map((s) => Number(s.xp) || 0)),
      },
      indicators: ((indRes.data ?? []) as { code: string; description: string }[]).filter((i) => codes.has(i.code)).map((i) => ({ code: i.code, description: i.description })),
      blocks,
      group,
      recovery_indicator_codes: target,
    };

    if (!blocks.length) return { ok: false as const, error: "Nenhum bloco desta missão possui indicadores associados." };

    // Sem nenhuma evidência: não gasta IA, devolve tudo para revisão docente
    if (blocks.every((b) => !b.answers.length && !b.entries.length)) {
      return { ok: true as const, model: MODEL, aiUsed: false, result: sanitizeEvaluation({ blocks: [], general_feedback: "", member_overrides: [], alerts: ["Entrega sem respostas ou registros: revisão docente necessária."] }, ctx) };
    }

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "Serviço de IA não configurado." };

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: target ? `${SYSTEM}\n${RECOVERY(target)}` : SYSTEM },
            { role: "user", content: `Entrega (json):\n${JSON.stringify(ctx)}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "avaliacao", strict: true, schema: SCHEMA } },
        }),
      });
    } catch {
      return { ok: false as const, error: "Sem conexão com o serviço de IA. Tente novamente em instantes." };
    }
    if (!res.ok) {
      const msg =
        res.status === 429 ? "Muitas solicitações. Aguarde alguns segundos e tente novamente."
        : res.status === 402 ? "Créditos de IA insuficientes no workspace."
        : res.status === 403 ? "Uso de IA bloqueado pelas configurações do workspace."
        : "Serviço de IA indisponível no momento.";
      console.error("AI gateway", res.status, await res.text().catch(() => ""));
      return { ok: false as const, error: msg };
    }
    try {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "") as AiAnswer;
      if (!Array.isArray(parsed?.blocks)) throw new Error("formato");
      return { ok: true as const, model: MODEL, aiUsed: true, result: sanitizeEvaluation(parsed, ctx) };
    } catch {
      return { ok: false as const, error: "A IA retornou uma resposta inválida. Tente gerar novamente." };
    }
  });
