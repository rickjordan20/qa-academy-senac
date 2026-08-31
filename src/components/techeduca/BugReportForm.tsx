import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLASSIFICATIONS, useCreateBugReport, type BugReport } from "@/lib/techeduca";

export function BugReportForm({
  userId,
  runId,
  missionId,
  onCreated,
}: {
  userId: string | null;
  runId: string | null;
  missionId: string | null;
  onCreated?: (bug: BugReport) => void;
}) {
  const create = useCreateBugReport(userId);
  const [feature, setFeature] = useState("");
  const [problem, setProblem] = useState("");
  const [classification, setClassification] = useState<string>("defeito");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [obtained, setObtained] = useState("");
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!feature.trim() || !problem.trim()) {
      toast.error("Informe a funcionalidade e o problema.");
      return;
    }
    try {
      const bug = await create.mutateAsync({
        run_id: runId,
        mission_id: missionId,
        feature: feature.trim(),
        problem: problem.trim(),
        classification,
        steps: steps.trim(),
        expected_result: expected.trim(),
        obtained_result: obtained.trim(),
        note: note.trim() || null,
      });
      setFeature("");
      setProblem("");
      setSteps("");
      setExpected("");
      setObtained("");
      setNote("");
      toast.success("Registro salvo no seu histórico individual.");
      onCreated?.(bug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o registro.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="feature">Funcionalidade</Label>
        <Input
          id="feature"
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          placeholder="Ex.: Cadastro de aluno"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="classification">Classificação</Label>
        <Select value={classification} onValueChange={setClassification}>
          <SelectTrigger id="classification">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="problem">Problema</Label>
        <Input
          id="problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Descreva o problema em uma frase"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="steps">Passos para reproduzir</Label>
        <Textarea
          id="steps"
          rows={4}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={"1. Acessar...\n2. Preencher...\n3. Clicar em..."}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expected">Resultado esperado</Label>
        <Textarea id="expected" rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="obtained">Resultado obtido</Label>
        <Textarea id="obtained" rows={3} value={obtained} onChange={(e) => setObtained(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="note">Observação</Label>
        <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Salvando..." : "Registrar bug"}
        </Button>
      </div>
    </form>
  );
}
