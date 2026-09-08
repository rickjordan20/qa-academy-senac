import { CONCEPT_LABELS, nextAction, stageLabel } from "@/lib/assessment";
import { fmtDateTime } from "@/lib/mission-submissions";
import type { ClosureReport, ClosureStudent } from "@/lib/closure-report";
import { createCtx, ensure, footer, heading, newPage, rule, slugify, text, type Ctx } from "@/lib/pdf-kit";

/* ==================================================================== */
/* PDF de Fechamento da UC10 — somente leitura                           */
/* ==================================================================== */

function conceptText(value: string | null) {
  if (!value) return "Não avaliado";
  return `${value} — ${CONCEPT_LABELS[value] ?? value}`;
}

function studentPage(ctx: Ctx, s: ClosureStudent) {
  newPage(ctx);
  text(ctx, s.name.toUpperCase(), { size: 14, style: "bold", gap: 0 });
  text(ctx, s.email, { size: 9, color: 110 });
  rule(ctx);

  text(ctx, `Situação na UC10: ${s.situation.label}`, { size: 11, style: "bold", gap: 0 });
  text(
    ctx,
    `Resultado final: ${s.result?.final_result ?? "Não confirmado"}${
      s.result?.confirmed_at ? ` (confirmado em ${fmtDateTime(s.result.confirmed_at)})` : ""
    }`,
    { size: 10, gap: 0 },
  );
  if (s.situation.suggestion)
    text(ctx, `Sugestão do sistema: ${s.situation.suggestion} (confirmação é sempre manual)`, {
      size: 9,
      color: 110,
      gap: 0,
    });
  if (s.result?.notes?.trim()) text(ctx, `Observações do fechamento: ${s.result.notes}`, { size: 9, gap: 0 });

  heading(ctx, "INDICADORES I1–I6");
  for (const i of s.indicators) {
    ensure(ctx, 50);
    text(ctx, `${i.code} — ${conceptText(i.concept)}`, { size: 10, style: "bold", gap: 0 });
    text(ctx, i.description, { size: 9, indent: 12, color: 90, gap: 0 });
    text(ctx, `Etapa: ${stageLabel(i.stage)} | Avaliado em: ${fmtDateTime(i.evaluatedAt)}`, {
      size: 9,
      indent: 12,
      gap: 0,
    });
    if (i.notes.trim()) text(ctx, `Observações: ${i.notes}`, { size: 9, indent: 12, gap: 0 });
    if (i.origins.length) {
      text(ctx, "Origem das menções (missões avaliadas):", { size: 9, indent: 12, style: "bold", gap: 0 });
      for (const o of i.origins)
        text(ctx, `- ${o.mission}: ${o.concept} (${fmtDateTime(o.at)})`, { size: 9, indent: 22, gap: 0 });
    }
    if (i.history.length) {
      text(ctx, "Histórico de menções:", { size: 9, indent: 12, style: "bold", gap: 0 });
      for (const h of i.history)
        text(ctx, `- ${fmtDateTime(h.at)} | ${stageLabel(h.stage)} | ${h.concept ?? "—"}${h.notes ? ` | ${h.notes}` : ""}`, {
          size: 9,
          indent: 22,
          gap: 0,
        });
    }
    ctx.y += 4;
  }

  if (s.situation.pending.length) {
    heading(ctx, "RECUPERAÇÃO FINAL");
    text(ctx, `Indicadores pendentes (NA): ${s.situation.pending.map((i) => i.code).join(", ")}`, {
      size: 10,
      gap: 0,
    });
    text(ctx, `Recuperação Final concluída: ${s.situation.recoveryDone ? "Sim" : "Não"}`, { size: 10, gap: 0 });
    for (const r of s.recovery) {
      text(ctx, `Plano: ${r.title} (${r.status}) — ${fmtDateTime(r.at)}`, { size: 10, style: "bold", gap: 0 });
      text(ctx, `Indicadores: ${r.indicators.join(", ") || "—"}`, { size: 9, indent: 12, gap: 0 });
      if (r.description.trim()) text(ctx, r.description, { size: 9, indent: 12, gap: 0 });
    }
  }

  if (s.feedbacks.length) {
    heading(ctx, "FEEDBACKS DO INSTRUTOR");
    for (const f of s.feedbacks)
      text(ctx, `${fmtDateTime(f.at)}${f.indicator ? ` [${f.indicator}]` : ""}: ${f.message}`, {
        size: 9,
        gap: 0,
      });
  }

  heading(ctx, "XP E BADGES (INFORMATIVO)");
  text(ctx, "XP e badges são de engajamento e não influenciam as menções A/PA/NA nem o resultado D/ND.", {
    size: 9,
    style: "italic",
    color: 90,
  });
  text(ctx, `XP aprovado: ${s.xpTotal} | XP pendente de validação: ${s.xpPending}`, { size: 10, gap: 0 });
  text(ctx, `Badges (${s.badges.length}): ${s.badges.map((b) => b.name).join(", ") || "—"}`, { size: 10, gap: 0 });
}

export function generateClosureReportPdf(report: ClosureReport, students?: ClosureStudent[]) {
  const list = students ?? report.students;
  const scope = list.length === 1 ? list[0]!.name : report.className;
  const ctx = createCtx(`Fechamento UC10 — ${scope}`);

  text(ctx, "QA ACADEMY", { size: 20, style: "bold", gap: 2 });
  text(ctx, "Relatório de Fechamento da UC10", { size: 13, style: "bold", gap: 10 });
  rule(ctx);
  const info: [string, string][] = [
    ["Turma", report.className],
    ["Escopo", list.length === 1 ? `Aluno: ${list[0]!.name}` : `Turma completa (${list.length} alunos)`],
    ["Gerado em", fmtDateTime(report.generatedAt)],
  ];
  for (const [k, v] of info) text(ctx, `${k}: ${v}`, { size: 10, gap: 0 });

  ctx.y += 10;
  heading(ctx, "Resumo da turma");
  const s = report.summary;
  const resume: [string, number][] = [
    ["Alunos", s.total],
    ["Não avaliados", s.notEvaluated],
    ["Em andamento", s.inProgress],
    ["Avaliação Final em aberto", s.finalOpen],
    ["Necessitam Recuperação Final", s.needsRecovery],
    ["Em Recuperação Final", s.inRecovery],
    ["Prontos para fechar D/ND", s.readyToClose],
    ["Desenvolvido (D)", s.d],
    ["Não Desenvolvido (ND)", s.nd],
  ];
  for (const [k, v] of resume) text(ctx, `${k}: ${v}`, { size: 10, gap: 0 });

  if (list.length > 1) {
    ctx.y += 8;
    heading(ctx, "Situação por aluno");
    for (const st of list)
      text(ctx, `${st.name}: ${st.situation.label}${st.result?.final_result ? ` | ${st.result.final_result}` : ""}`, {
        size: 9,
        gap: 0,
      });
  }

  for (const st of list) studentPage(ctx, st);

  footer(ctx);
  ctx.doc.save(`fechamento-uc10-${slugify(scope) || "turma"}.pdf`);
}
