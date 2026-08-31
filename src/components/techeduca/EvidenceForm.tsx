import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEvidence, type BugReport } from "@/lib/techeduca";

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
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [bugId, setBugId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Dê um título para a evidência.");
      return;
    }
    if (!link.trim() && !file) {
      toast.error("Anexe um arquivo ou informe um link.");
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        link: link.trim() || null,
        run_id: runId,
        bug_report_id: bugId || null,
        file,
      });
      setTitle("");
      setDescription("");
      setLink("");
      setBugId("");
      setFile(null);
      (e.target as HTMLFormElement).reset();
      toast.success("Evidência registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a evidência.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="ev-title">Título</Label>
        <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-link">Link (opcional)</Label>
        <Input
          id="ev-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-file">Arquivo (imagem, PDF, vídeo curto)</Label>
        <Input
          id="ev-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
        <Label htmlFor="ev-desc">Descrição</Label>
        <Textarea
          id="ev-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Enviando..." : "Adicionar evidência"}
        </Button>
      </div>
    </form>
  );
}
