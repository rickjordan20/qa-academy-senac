/* ==================================================================== */
/* Avaliação assistida por IA — módulo PURO (sem banco, sem rede).       */
/* Constrói o contexto da entrega, valida/saneia a resposta da IA e      */
/* calcula o preenchimento do formulário sem sobrescrever o que o        */
/* instrutor já editou. Nada aqui grava avaliações.                      */
/* ==================================================================== */

export type Concept = "A" | "PA" | "NA";
const CONCEPTS = new Set(["A", "PA", "NA"]);

export type CtxBlock = {
  section_id: string;
  title: string;
  kind: string;
  description: string;
  instructions: string;
  indicator_codes: string[];
  xp_max: number;
  answers: { label: string; value: string }[];
  entries: { title: string; kind: string; author: string | null; data: Record<string, string>; link: string | null }[];
};

export type CtxMember = {
  id: string;
  name: string;
  role: string;
  tasks_assigned: number;
  tasks_done: number;
  contributions: number;
  entries: number;
};

export type EvalContext = {
  mission: { title: string; objective: string; description: string; base_xp: number; xp_cap: number };
  indicators: { code: string; description: string }[];
  blocks: CtxBlock[];
  group: { members: CtxMember[] } | null;
  /** Recuperação personalizada: indicadores congelados na tentativa (null = missão convencional). */
  recovery_indicator_codes?: string[] | null;
};

/**
 * Restringe blocos aos indicadores liberados na tentativa. Blocos sem nenhum
 * indicador liberado saem; em blocos com vários indicadores, só ficam os liberados.
 * `target` null/undefined = missão convencional (sem alteração).
 */
export function scopeBlocksToTarget<T extends { indicator_codes?: string[] }>(blocks: T[], target: string[] | null | undefined): T[] {
  if (!target) return blocks;
  const set = new Set(target);
  return blocks
    .map((b) => ({ ...b, indicator_codes: (b.indicator_codes ?? []).filter((c) => set.has(c)) }))
    .filter((b) => b.indicator_codes.length > 0);
}

export type AiBlock = {
  section_id: string;
  indicators: { code: string; mention: string | null; justification: string }[];
  xp: number;
  feedback: string;
  evidence_used: string[];
  needs_review: boolean;
  alerts: string[];
};

export type AiAnswer = {
  blocks: AiBlock[];
  general_feedback: string;
  member_overrides: { student_id: string; code: string; mention: string; reason: string }[];
  alerts: string[];
};

export type CleanBlock = {
  section_id: string;
  title: string;
  indicators: Record<string, Concept>;
  justifications: Record<string, string>;
  xp: number;
  xp_max: number;
  feedback: string;
  evidence_used: string[];
  needs_review: boolean;
  alerts: string[];
};

export type CleanEvaluation = {
  blocks: CleanBlock[];
  finals: Record<string, Concept>;
  /** null = sem critério fundamentado (blocos sem XP próprio): decisão docente */
  xp: number | null;
  xpCap: number;
  generalFeedback: string;
  memberOverrides: Record<string, Record<string, Concept>>;
  overrideNotes: string;
  alerts: string[];
};

/** Teto de XP pelas regras já cadastradas: XP base da missão; sem XP base, soma dos XP dos blocos. */
export function missionXpCap(baseXp: number, sectionXps: number[]): number {
  const base = Math.max(0, Math.floor(Number(baseXp) || 0));
  if (base > 0) return base;
  return sectionXps.reduce((s, v) => s + Math.max(0, Math.floor(Number(v) || 0)), 0);
}

function clampInt(v: unknown, max: number) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, Math.max(0, max));
}

/** Mesma regra de sugestão da ficha (suggestConcept): NA → NA; todas A → A; senão PA. */
function consolidate(values: Concept[]): Concept | null {
  if (!values.length) return null;
  if (values.includes("NA")) return "NA";
  return values.every((v) => v === "A") ? "A" : "PA";
}

export function hasEvidence(b: CtxBlock) {
  return b.answers.some((a) => a.value.trim()) || b.entries.length > 0;
}

/** Valida a resposta da IA contra o contexto real; descarta o que não existir. */
export function sanitizeEvaluation(ai: AiAnswer, rawCtx: EvalContext): CleanEvaluation {
  // Defesa em profundidade: mesmo que o contexto traga blocos ocultos, só os liberados contam.
  const ctx: EvalContext = { ...rawCtx, blocks: scopeBlocksToTarget(rawCtx.blocks, rawCtx.recovery_indicator_codes) };
  const target = rawCtx.recovery_indicator_codes ? new Set(rawCtx.recovery_indicator_codes) : null;
  const hidden = target ? ["I1", "I2", "I3", "I4", "I5", "I6"].filter((c) => !target.has(c)) : [];
  const mentionsHidden = (s: string) => hidden.some((c) => new RegExp(`\\b${c}\\b`).test(s));
  const alerts: string[] = (Array.isArray(ai?.alerts) ? ai.alerts : [])
    .filter((s) => typeof s === "string" && s.trim() && !mentionsHidden(s))
    .slice(0, 8);
  const aiById = new Map((Array.isArray(ai?.blocks) ? ai.blocks : []).map((b) => [b?.section_id, b]));
  const blocks: CleanBlock[] = ctx.blocks.map((b) => {
    const a = aiById.get(b.section_id);
    const evidence = hasEvidence(b);
    const indicators: Record<string, Concept> = {};
    const justifications: Record<string, string> = {};
    const bAlerts: string[] = [];
    for (const it of Array.isArray(a?.indicators) ? a!.indicators : []) {
      if (!b.indicator_codes.includes(it?.code)) continue;
      if (typeof it.justification === "string") justifications[it.code] = it.justification.trim();
      if (it.mention && CONCEPTS.has(it.mention)) {
        // Sem evidência mínima não se atribui A/PA.
        if (!evidence && it.mention !== "NA") continue;
        indicators[it.code] = it.mention as Concept;
      }
    }
    let needs = !a || !!a.needs_review || !evidence;
    if (b.indicator_codes.some((c) => !indicators[c])) needs = true;
    if (!evidence) bAlerts.push("Bloco sem respostas ou registros: revisão docente necessária.");
    if (!a) bAlerts.push("A IA não analisou este bloco.");
    for (const s of Array.isArray(a?.alerts) ? a!.alerts : []) if (typeof s === "string" && s.trim()) bAlerts.push(s.trim());
    const xpMax = Math.max(0, Math.floor(b.xp_max || 0));
    return {
      section_id: b.section_id,
      title: b.title,
      indicators,
      justifications,
      xp: evidence ? clampInt(a?.xp, xpMax) : 0,
      xp_max: xpMax,
      feedback: typeof a?.feedback === "string" ? a.feedback.trim() : "",
      evidence_used: (Array.isArray(a?.evidence_used) ? a!.evidence_used : []).filter((s) => typeof s === "string").slice(0, 8),
      needs_review: needs,
      alerts: bAlerts,
    };
  });

  // Consolidação por indicador: regra existente da ficha (não cria regra nova)
  const byCode = new Map<string, Concept[]>();
  for (const b of blocks) for (const [c, v] of Object.entries(b.indicators)) byCode.set(c, [...(byCode.get(c) ?? []), v]);
  const finals: Record<string, Concept> = {};
  for (const [c, list] of byCode) {
    const v = consolidate(list);
    if (v) finals[c] = v;
  }

  // XP: soma dos blocos (cada um no seu limite), limitada ao teto da missão
  const xpCap = ctx.mission.xp_cap;
  const anyBlockXp = ctx.blocks.some((b) => b.xp_max > 0);
  // Sem limites por bloco não há regra oficial de distribuição: não sugere XP.
  const xp = anyBlockXp ? Math.min(xpCap, blocks.reduce((s, b) => s + b.xp, 0)) : null;
  if (xp === null) alerts.push("Os blocos desta missão não têm XP próprio: defina o XP manualmente (revisão docente necessária).");

  // Diferenciações individuais: só integrantes reais e indicadores consolidados
  const memberOverrides: Record<string, Record<string, Concept>> = {};
  const reasons: string[] = [];
  const memberIds = new Set((ctx.group?.members ?? []).map((m) => m.id));
  for (const o of Array.isArray(ai?.member_overrides) ? ai.member_overrides : []) {
    if (!memberIds.has(o?.student_id) || !finals[o.code] || !CONCEPTS.has(o.mention)) continue;
    if (o.mention === finals[o.code]) continue;
    if (typeof o.reason !== "string" || o.reason.trim().length < 10) continue;
    (memberOverrides[o.student_id] ??= {})[o.code] = o.mention as Concept;
    const name = ctx.group?.members.find((m) => m.id === o.student_id)?.name ?? "Integrante";
    reasons.push(`${name} (${o.code}): ${o.reason.trim()}`);
  }

  if (blocks.some((b) => b.needs_review)) alerts.unshift("Há blocos que exigem decisão manual do instrutor.");
  return {
    blocks,
    finals,
    xp,
    xpCap,
    generalFeedback: typeof ai?.general_feedback === "string" ? ai.general_feedback.trim() : "",
    memberOverrides,
    overrideNotes: reasons.join("\n"),
    alerts,
  };
}

/* ------------------------- Aplicação no formulário ------------------------ */

export type FormState = {
  xp: string;
  feedback: string;
  blockConcepts: Record<string, Record<string, string>>;
  blockComments: Record<string, string>;
  finals: Record<string, string>;
  memberOverrides: Record<string, Record<string, string>>;
  overrideNotes: string;
};

export type Conflict = { field: string; label: string; current: string; suggested: string };

/**
 * Mescla a sugestão no formulário. Campos vazios são preenchidos; campos que o
 * instrutor já preencheu/alterou (lista `touched`) só mudam com `overwrite=true`.
 * Retorna o novo estado e a lista de conflitos encontrados.
 */
export function mergeSuggestion(
  form: FormState,
  s: CleanEvaluation,
  touched: Set<string>,
  overwrite: boolean,
): { next: FormState; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  const next: FormState = {
    xp: form.xp,
    feedback: form.feedback,
    blockConcepts: Object.fromEntries(Object.entries(form.blockConcepts).map(([k, v]) => [k, { ...v }])),
    blockComments: { ...form.blockComments },
    finals: { ...form.finals },
    memberOverrides: Object.fromEntries(Object.entries(form.memberOverrides).map(([k, v]) => [k, { ...v }])),
    overrideNotes: form.overrideNotes,
  };
  const put = (field: string, label: string, current: string, suggested: string, set: () => void) => {
    if (!suggested || current === suggested) return;
    if (current && touched.has(field)) {
      conflicts.push({ field, label, current, suggested });
      if (!overwrite) return;
    }
    set();
  };
  for (const b of s.blocks) {
    for (const [code, v] of Object.entries(b.indicators)) {
      put(`block:${b.section_id}:${code}`, `${b.title} · ${code}`, form.blockConcepts[b.section_id]?.[code] ?? "", v, () => {
        (next.blockConcepts[b.section_id] ??= {})[code] = v;
      });
    }
    put(`comment:${b.section_id}`, `Comentário · ${b.title}`, form.blockComments[b.section_id] ?? "", b.feedback, () => {
      next.blockComments[b.section_id] = b.feedback;
    });
  }
  for (const [code, v] of Object.entries(s.finals)) {
    put(`final:${code}`, `Menção final ${code}`, form.finals[code] ?? "", v, () => {
      next.finals[code] = v;
    });
  }
  for (const [sid, map] of Object.entries(s.memberOverrides)) {
    for (const [code, v] of Object.entries(map)) {
      put(`member:${sid}:${code}`, `Diferenciação ${code}`, form.memberOverrides[sid]?.[code] ?? "", v, () => {
        (next.memberOverrides[sid] ??= {})[code] = v;
      });
    }
  }
  put("overrideNotes", "Justificativa da diferenciação", form.overrideNotes, s.overrideNotes, () => {
    next.overrideNotes = s.overrideNotes;
  });
  if (s.xp !== null) {
    const xpText = String(s.xp);
    put("xp", "XP", form.xp, xpText, () => {
      next.xp = xpText;
    });
  }
  put("feedback", "Feedback geral", form.feedback, s.generalFeedback, () => {
    next.feedback = s.generalFeedback;
  });
  return { next, conflicts };
}

/** Impressão digital da entrega + critérios: reaproveita a análise enquanto nada mudar. */
export function submissionFingerprint(parts: unknown): string {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
