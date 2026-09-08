import { blockDef } from "@/lib/mission-builder";
import { EVAL_LABEL, fmtDateTime } from "@/lib/mission-submissions";
import type { MissionReport, ReportTarget } from "@/lib/mission-report";
import { createCtx, ensure, footer, heading, link, newPage, rule, slugify, text, type Ctx } from "@/lib/pdf-kit";

/* ==================================================================== */
/* Geração do PDF — apenas leitura dos dados já existentes               */
/* ==================================================================== */

function statusLabel(t: ReportTarget, isGroup: boolean) {
  if (!t.run) return isGroup ? "Não entregue" : "Não iniciado";
  if (t.run.eval_status && t.run.eval_status !== "none") return EVAL_LABEL[t.run.eval_status] ?? t.run.eval_status;
  if (t.run.submitted_at) return "Enviada";
  return "Em andamento";
}

function conceptFor(t: ReportTarget, code: string) {
  const value = t.indicatorFinals[code];
  if (value) return value;
  if (!t.run || !t.run.submitted_at) return "Não avaliado";
  return "Aguardando avaliação";
}

export function generateMissionReportPdf(report: MissionReport) {
  const { mission, className, isGroup, targets, summary } = report;
  const missionLabel = `${mission.lesson_number ? `Aula ${mission.lesson_number} — ` : ""}${mission.title}`;
  const ctx: Ctx = createCtx(missionLabel);
  const doc = ctx.doc;


  /* ------------------------------- capa ------------------------------ */
  text(ctx, "QA ACADEMY", { size: 20, style: "bold", gap: 2 });
  text(ctx, "Relatório de Entregas por Missão", { size: 13, style: "bold", gap: 10 });
  rule(ctx);
  const info: [string, string][] = [
    ["Turma", className],
    ["Missão", mission.title],
    ["Aula", mission.lesson_number ? String(mission.lesson_number) : "—"],
    ["Modalidade", isGroup ? "Grupo" : "Individual"],
    ["Carga horária", mission.workload || "—"],
    ["XP base", String(mission.base_xp ?? 0)],
    ["Data de abertura", fmtDateTime(mission.opens_at)],
    ["Prazo", fmtDateTime(mission.due_at)],
    ["Gerado em", fmtDateTime(new Date().toISOString())],
  ];
  for (const [k, v] of info) text(ctx, `${k}: ${v}`, { size: 10, gap: 0 });

  ctx.y += 10;
  heading(ctx, "Resumo");
  const resume: [string, number][] = [
    ["Total esperado de entregas", summary.expected],
    ["Entregas realizadas", summary.delivered],
    ["Não iniciadas", summary.notStarted],
    ["Em andamento", summary.inProgress],
    ["Aguardando avaliação", summary.awaiting],
    ["Em avaliação", summary.inReview],
    ["Revisão solicitada", summary.revision],
    ["Reavaliação necessária", summary.reeval],
    ["Avaliadas", summary.evaluated],
  ];
  for (const [k, v] of resume) text(ctx, `${k}: ${v}`, { size: 10, gap: 0 });


  /* ------------------------ alunos / grupos -------------------------- */
  for (const t of targets) {
    newPage(ctx);
    text(ctx, t.name.toUpperCase(), { size: 14, style: "bold", gap: 2 });
    rule(ctx);

    if (isGroup) {
      text(ctx, "Integrantes:", { size: 10, style: "bold", gap: 0 });
      if (t.members.length === 0) text(ctx, "— sem integrantes cadastrados", { size: 10, indent: 12, gap: 0 });
      for (const m of t.members) text(ctx, `- ${m}`, { size: 10, indent: 12, gap: 0 });
      ctx.y += 4;
    } else {
      text(ctx, `Turma: ${className}`, { size: 10, gap: 0 });
    }

    text(ctx, `Status: ${statusLabel(t, isGroup)}`, { size: 10, gap: 0 });
    text(ctx, `Progresso: ${t.run?.progress ?? 0}%`, { size: 10, gap: 0 });
    if (t.run) {
      text(ctx, `Tentativa: ${t.run.attempt}`, { size: 10, gap: 0 });
      if (t.hasPreviousAttempts) text(ctx, "Possui tentativas anteriores: Sim", { size: 10, gap: 0 });
      text(ctx, `Último envio: ${fmtDateTime(t.run.submitted_at)}`, { size: 10, gap: 0 });
    } else {
      text(ctx, "Entrega: Não realizada", { size: 10, gap: 0 });
      continue;
    }

    ctx.y += 6;
    heading(ctx, isGroup ? "ENTREGA DO GRUPO" : "ENTREGA DO ALUNO");

    if (t.blocks.length === 0) {
      text(ctx, "Nenhum bloco com produção registrada.", { size: 10, style: "italic" });
    }

    for (const b of t.blocks) {
      const def = blockDef(b.section.kind);
      ensure(ctx, 60);
      text(ctx, `${def.icon} ${b.section.title || def.label}`, { size: 11, style: "bold", gap: 2 });

      if (b.planned.length) {
        text(ctx, "Indicadores avaliados neste bloco:", { size: 9, style: "bold", gap: 0 });
        for (const i of b.planned)
          text(ctx, `${i.code} — ${i.description || "indicador da UC10"}`, { size: 9, indent: 12, gap: 0 });
        ctx.y += 2;
      }

      // conteúdo entregue
      if (b.checklist.length) {
        for (const c of b.checklist) text(ctx, `${c.done ? "[x]" : "[ ]"} ${c.label}`, { size: 10, indent: 8, gap: 0 });
        ctx.y += 2;
      }
      for (const p of b.pairs) {
        text(ctx, p.label, { size: 9, style: "bold", indent: 8, gap: 0 });
        text(ctx, p.value, { size: 10, indent: 8, gap: 2 });
      }
      b.entries.forEach((e, idx) => {
        ensure(ctx, 40);
        text(ctx, `${idx + 1}. ${e.title}`, { size: 10, style: "bold", indent: 8, gap: 1 });
        for (const f of e.fields) text(ctx, `${f.label}: ${f.value}`, { size: 9, indent: 16, gap: 0 });
        if (e.link) link(ctx, "Link: ", e.link);
        ctx.y += 2;
      });
      if (!b.checklist.length && !b.pairs.length && !b.entries.length)
        text(ctx, "Sem conteúdo registrado neste bloco.", { size: 9, style: "italic", indent: 8 });

      // avaliação do bloco
      if (b.planned.length) {
        ensure(ctx, 40);
        text(ctx, "AVALIAÇÃO DO BLOCO", { size: 9, style: "bold", gap: 1 });
        for (const i of b.planned) {
          const concept = b.result?.indicators?.[i.code];
          const value = concept ?? (t.run?.submitted_at ? "Aguardando avaliação" : "Não avaliado");
          text(ctx, `${i.code} — ${value}`, { size: 9, indent: 12, gap: 0 });
        }
        if (b.result?.comment) {
          text(ctx, "Comentário:", { size: 9, style: "bold", indent: 12, gap: 0 });
          text(ctx, b.result.comment, { size: 9, indent: 12, gap: 0 });
        }
      }
      rule(ctx);
    }

    /* --------------------- consolidação final ----------------------- */
    const missionCodes = new Set<string>([
      ...(mission.indicator_codes ?? []),
      ...t.blocks.flatMap((b) => b.planned.map((p) => p.code)),
      ...Object.keys(t.indicatorFinals),
    ]);
    if (missionCodes.size) {
      ensure(ctx, 60);
      heading(ctx, "RESULTADO DOS INDICADORES");
      for (const code of [...missionCodes].sort()) text(ctx, `${code} — ${conceptFor(t, code)}`, { size: 10, gap: 0 });
      ctx.y += 4;
    }

    if (isGroup && t.individual.length) {
      heading(ctx, "AVALIAÇÕES INDIVIDUAIS");
      for (const ind of t.individual) {
        text(ctx, `Aluno: ${ind.name}`, { size: 10, style: "bold", gap: 0 });
        for (const [code, concept] of Object.entries(ind.indicators))
          text(ctx, `${code}: ${concept}`, { size: 10, indent: 12, gap: 0 });
        ctx.y += 2;
      }
    }

    ensure(ctx, 60);
    heading(ctx, "XP E FEEDBACK");
    const evaluated = t.run.eval_status === "evaluated" || t.run.xp_awarded != null;
    text(ctx, evaluated ? `XP obtido: ${t.run.xp_awarded ?? 0} / ${mission.base_xp ?? 0}` : "XP da avaliação: Aguardando avaliação", {
      size: 10,
      gap: 0,
    });
    text(ctx, "Feedback geral:", { size: 10, style: "bold", gap: 0 });
    text(ctx, t.run.feedback?.trim() ? t.run.feedback : "Aguardando avaliação", { size: 10, indent: 8 });
  }

  footer(ctx);
  const slug = missionLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`entregas-${slug || "missao"}.pdf`);
}
