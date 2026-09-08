import { jsPDF } from "jspdf";

/* ==================================================================== */
/* Helpers compartilhados de PDF (A4, pt) — usados pelos relatórios      */
/* ==================================================================== */

export const M = 44; // margem
export const W = 595.28; // A4 pt
export const H = 841.89;
export const BOTTOM = H - 56;

export type Ctx = { doc: jsPDF; y: number; label: string };

export function createCtx(label: string): Ctx {
  return { doc: new jsPDF({ unit: "pt", format: "a4" }), y: M, label };
}

export function footer(ctx: Ctx) {
  const doc = ctx.doc;
  const page = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text(ctx.label.slice(0, 90), M, H - 30);
  doc.text(`Página ${page}`, W - M, H - 30, { align: "right" });
  doc.setTextColor(0);
}

export function newPage(ctx: Ctx) {
  footer(ctx);
  ctx.doc.addPage();
  ctx.y = M;
}

export function ensure(ctx: Ctx, needed: number) {
  if (ctx.y + needed > BOTTOM) newPage(ctx);
}

export function text(
  ctx: Ctx,
  value: string,
  opts?: {
    size?: number;
    style?: "normal" | "bold" | "italic";
    indent?: number;
    color?: number;
    gap?: number;
  },
) {
  const size = opts?.size ?? 10;
  const style = opts?.style ?? "normal";
  const indent = opts?.indent ?? 0;
  const doc = ctx.doc;
  doc.setFont("helvetica", style).setFontSize(size).setTextColor(opts?.color ?? 0);
  const lines = doc.splitTextToSize(value || "—", W - M * 2 - indent) as string[];
  const lh = size * 1.32;
  for (const line of lines) {
    ensure(ctx, lh);
    doc.setFont("helvetica", style).setFontSize(size).setTextColor(opts?.color ?? 0);
    doc.text(line, M + indent, ctx.y + size);
    ctx.y += lh;
  }
  ctx.y += opts?.gap ?? 2;
  doc.setTextColor(0);
}

export function rule(ctx: Ctx) {
  ensure(ctx, 10);
  ctx.doc.setDrawColor(200).line(M, ctx.y + 2, W - M, ctx.y + 2);
  ctx.y += 8;
}

export function heading(ctx: Ctx, value: string) {
  ensure(ctx, 34);
  ctx.doc.setFillColor(238, 240, 244).rect(M, ctx.y, W - M * 2, 22, "F");
  ctx.doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
  ctx.doc.text(value, M + 8, ctx.y + 15);
  ctx.y += 30;
  ctx.doc.setTextColor(0);
}

export function link(ctx: Ctx, label: string, url: string) {
  const doc = ctx.doc;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(20, 70, 170);
  const lines = doc.splitTextToSize(`${label}${url}`, W - M * 2 - 12) as string[];
  for (const line of lines) {
    ensure(ctx, 12);
    doc.textWithLink(line, M + 12, ctx.y + 9, { url });
    ctx.y += 12;
  }
  doc.setTextColor(0);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
