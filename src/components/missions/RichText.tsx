/**
 * Renderizador único de texto longo dos blocos de missão.
 * Markdown simples e seguro (sem HTML arbitrário):
 * - "## " vira título
 * - "- " vira item de lista
 * - linha em branco vira separação de parágrafo
 */
export function RichText({ text, className }: { text: string; className?: string | undefined }) {
  if (!text?.trim()) return null;
  return (
    <div className={className ?? "space-y-1 text-sm leading-relaxed text-muted-foreground"}>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-2" />;
        if (t.startsWith("## "))
          return (
            <h4 key={i} className="text-sm font-semibold text-foreground">
              {t.slice(3)}
            </h4>
          );
        if (t.startsWith("- "))
          return (
            <p key={i} className="pl-4">
              • {t.slice(2)}
            </p>
          );
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

/** Dica padrão exibida ao instrutor nos campos que aceitam a formatação. */
export const MARKDOWN_HINT = "Use ## para títulos e - para listas.";
