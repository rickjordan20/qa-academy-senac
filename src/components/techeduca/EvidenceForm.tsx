import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceGuide } from "@/components/EvidenceGuide";
import { isValidEvidenceUrl } from "@/lib/qa";
import { useCreateEvidence, type BugReport } from "@/lib/techeduca";

const KINDS = [
  "Imagem / Print",
  "Documento / PDF",
  "Vídeo",
  "Log",
  "GitHub / Código",
  "Aplicação publicada",
  "Outro",
];

export function EvidenceForm({
  userId,
  runId,
  bugs,
}: {
  userId: string | null;
  runId: string | null;
  bugs?: BugReport[];
}) {
  const create = useCreateEvidence(userId);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState(KINDS[0]!);
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [content, setContent] = useState("");
  const [bugId, setBugId] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Dê um título para a evidência.");
      return;
    }
    if (!description.trim()) {
      toast.error("Explique o que esta evidência demonstra.");
      return;
    }
    if (!content.trim() && !isValidEvidenceUrl(link)) {
      toast.error("Informe um link válido para a evidência.");
      return;
    }
    if (link.trim() && !isValidEvidenceUrl(link)) {
      toast.error("Informe um link válido para a evidência.");
      return;
    }
    try {
      const desc = [`Tipo: ${kind}`, description.trim(), content.trim() ? `Log:\n${content.trim()}` : ""]
        .filter(Boolean)
        .join("\n\n");
      await create.mutateAsync({
        title: title.trim(),
        description: desc,
        link: link.trim() || null,
        run_id: runId,
        bug_report_id: bugId || null,
      });
      setTitle("");
      setDescription("");
      setLink("");
      setContent("");
      setBugId("");
      (e.target as HTMLFormElement).reset();
      toast.success("Evidência registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a evidência.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <EvidenceGuide />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-title">Título</Label>
        <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-kind">Tipo</Label>
        <select
          id="ev-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ev-link">URL da evidência (https://...)</Label>
        <Input
          id="ev-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://drive.google.com/..."
        />
      </div>
      {bugs && bugs.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="ev-bug">Vincular a um registro</Label>
          <select
            id="ev-bug"
            value={bugId}
            onChange={(e) => setBugId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Nenhum</option>
            {bugs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.feature} — {b.problem.slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ev-desc">Descrição / contexto</Label>
        <Textarea
          id="ev-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explique o que esta evidência demonstra e sua relação com a atividade realizada."
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ev-content">Evidência textual / log (opcional — dispensa URL)</Label>
        <Textarea id="ev-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Enviando..." : "Adicionar evidência"}
        </Button>
      </div>
    </form>
  );
}
