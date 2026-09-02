/* ====================================================================== */
/* REGRA CENTRAL DE DATAS, HORÁRIOS E STATUS TEMPORAL DAS MISSÕES         */
/* ---------------------------------------------------------------------- */
/* Todas as telas (aluno, instrutor, assíncronas, Café Central, TechEduca, */
/* avaliação final e recuperação) DEVEM consumir estas funções.           */
/*                                                                        */
/* Banco: `opens_at` e `due_at` são TIMESTAMPTZ (UTC).                    */
/* Interface: sempre exibida/editada no fuso de Brasília (America/Sao_Paulo,*/
/* UTC-3, sem horário de verão desde 2019).                               */
/*                                                                        */
/* Compatibilidade com registros antigos (somente data, "YYYY-MM-DD"):    */
/*  - abertura  → 00:00 de Brasília do dia informado;                     */
/*  - prazo     → 23:59 de Brasília do dia informado.                     */
/* Nada é apagado nem reescrito no banco: a conversão é feita na leitura. */
/* ====================================================================== */

export const BR_TZ = "America/Sao_Paulo";
const BR_OFFSET = "-03:00";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Interpreta um valor vindo do banco como instante absoluto. */
export function parseMissionDate(value: string | null | undefined, kind: "opens" | "due"): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  // Registro antigo somente com data: aplica horário padrão de Brasília.
  if (DATE_ONLY.test(raw)) {
    const suffix = kind === "due" ? "T23:59:59.999" : "T00:00:00.000";
    const d = new Date(`${raw}${suffix}${BR_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // "YYYY-MM-DDTHH:mm" sem fuso (entrada datetime-local antiga) → Brasília.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(raw)) {
    const d = new Date(`${raw}${BR_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const parseOpensAt = (v: string | null | undefined) => parseMissionDate(v, "opens");
export const parseDueAt = (v: string | null | undefined) => parseMissionDate(v, "due");

/* ---------------------------------------------------------------------- */
/* Formatação                                                             */
/* ---------------------------------------------------------------------- */

/** "02/09/2026 às 08:00" no fuso de Brasília. */
export function fmtMissionDateTime(value: string | null | undefined, kind: "opens" | "due" = "due") {
  const d = parseMissionDate(value, kind);
  if (!d) return "—";
  const date = d.toLocaleDateString("pt-BR", { timeZone: BR_TZ });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: BR_TZ, hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

/** Versão curta "02/09/2026 08:00" (listagens). */
export function fmtMissionDateTimeShort(value: string | null | undefined, kind: "opens" | "due" = "due") {
  const d = parseMissionDate(value, kind);
  if (!d) return "—";
  return d.toLocaleString("pt-BR", { timeZone: BR_TZ, dateStyle: "short", timeStyle: "short" });
}

/* ---------------------------------------------------------------------- */
/* Formulário (input datetime-local ↔ ISO UTC)                            */
/* ---------------------------------------------------------------------- */

/** Valor para <input type="datetime-local"> no horário de Brasília. */
export function toDateTimeLocalValue(value: string | null | undefined, kind: "opens" | "due") {
  const d = parseMissionDate(value, kind);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Converte o valor do input (horário de Brasília) em ISO UTC para o banco. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}${BR_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/* ---------------------------------------------------------------------- */
/* Status temporal                                                        */
/* ---------------------------------------------------------------------- */

export type TemporalKey = "scheduled" | "open" | "overdue" | "always_open";

export type MissionSchedule = { opens_at?: string | null; due_at?: string | null };

/** Status puramente temporal, sem considerar execução do aluno. */
export function temporalStatus(mission: MissionSchedule, now: Date = new Date()): {
  key: TemporalKey;
  opensAt: Date | null;
  dueAt: Date | null;
} {
  const opensAt = parseOpensAt(mission.opens_at);
  const dueAt = parseDueAt(mission.due_at);
  const t = now.getTime();
  if (opensAt && t < opensAt.getTime()) return { key: "scheduled", opensAt, dueAt };
  if (dueAt && t > dueAt.getTime()) return { key: "overdue", opensAt, dueAt };
  if (!opensAt && !dueAt) return { key: "always_open", opensAt, dueAt };
  return { key: "open", opensAt, dueAt };
}

export type RunLike = {
  submitted_at?: string | null;
  eval_status?: string | null;
  status?: string | null;
  progress?: number | null;
} | null;

/** true quando o aluno já entregou/concluiu (prazo não pode marcar atraso). */
export function isRunDelivered(run: RunLike) {
  if (!run) return false;
  const evalStatus = run.eval_status ?? "none";
  if (["awaiting", "in_review", "evaluated"].includes(evalStatus)) return true;
  if (run.submitted_at) return true;
  if (run.status === "completed" || run.status === "submitted") return true;
  return false;
}

export type MissionBadge = { key: string; label: string; tone: string };

/**
 * Situação única de uma missão para um aluno/grupo.
 * Prioridade: status de execução/avaliação > status temporal.
 * "Atrasada" só aparece quando ainda há entrega pendente.
 */
export function missionSituation(
  mission: MissionSchedule & { status?: string | null },
  run: RunLike,
  now: Date = new Date(),
): MissionBadge {
  const evalStatus = run?.eval_status ?? "none";
  if (evalStatus === "evaluated") return { key: "evaluated", label: "Avaliada", tone: "bg-success/15 text-success" };
  if (evalStatus === "revision")
    return { key: "revision", label: "Revisão solicitada", tone: "bg-warning/15 text-warning" };
  if (evalStatus === "in_review") return { key: "in_review", label: "Em avaliação", tone: "bg-accent/15 text-accent" };
  if (evalStatus === "awaiting" || run?.submitted_at)
    return { key: "submitted", label: "Enviada", tone: "bg-accent/15 text-accent" };
  if (run?.status === "completed") return { key: "completed", label: "Concluída", tone: "bg-success/15 text-success" };

  const temporal = temporalStatus(mission, now);
  if (temporal.key === "scheduled")
    return { key: "scheduled", label: "Agendada", tone: "bg-secondary text-muted-foreground" };
  if (mission.status === "closed")
    return { key: "closed", label: "Encerrada", tone: "bg-secondary text-muted-foreground" };
  if (temporal.key === "overdue") return { key: "late", label: "Atrasada", tone: "bg-destructive/15 text-destructive" };
  if (run) return { key: "in_progress", label: "Em andamento", tone: "bg-warning/15 text-warning" };
  return { key: "available", label: "Disponível", tone: "bg-accent/10 text-accent" };
}

/** Missão ainda não abriu → conteúdo bloqueado. */
export function isMissionLocked(mission: MissionSchedule, now: Date = new Date()) {
  return temporalStatus(mission, now).key === "scheduled";
}

/** Atrasada de fato: prazo vencido e sem entrega. */
export function isMissionLate(mission: MissionSchedule, run: RunLike, now: Date = new Date()) {
  return temporalStatus(mission, now).key === "overdue" && !isRunDelivered(run);
}

/** Linha pronta para exibição: "Abertura: … · Prazo: …". */
export function scheduleSummary(mission: MissionSchedule) {
  const parts: string[] = [];
  if (mission.opens_at) parts.push(`Abertura: ${fmtMissionDateTime(mission.opens_at, "opens")}`);
  if (mission.due_at) parts.push(`Prazo: ${fmtMissionDateTime(mission.due_at, "due")}`);
  return parts.join(" · ");
}
