import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  closureDivergence,
  closureOptions,
  ND_EXCEPTIONAL_MIN_CHARS,
  useConfirmUcResult,
  type EvaluationRow,
  type IndicatorRow,
  type UcResult,
} from "@/lib/assessment";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  classId: string | null;
  studentId: string;
  indicators: IndicatorRow[];
  byIndicator: Map<string, EvaluationRow>;
  result: UcResult | null | undefined;
  compact?: boolean;
};

/** Botões D/ND com a mesma regra na Matriz e na Avaliação Final. */
export function ClosureControls({ classId, studentId, indicators, byIndicator, result, compact }: Props) {
  const { user } = useAuth();
  const confirm = useConfirmUcResult(classId);
  const opts = closureOptions(indicators, byIndicator);
  const divergence = closureDivergence(indicators, byIndicator, result);
  const [pending, setPending] = useState<{ value: "D" | "ND"; kind: "exceptional" | "rehomologate" } | null>(null);
  const [notes, setNotes] = useState("");

  async function save(value: "D" | "ND", text: string) {
    if (!user) return;
    try {
      await confirm.mutateAsync({ studentId, finalResult: value, notes: text, confirmedBy: user.id });
      toast.success(`Resultado ${value} confirmado`);
      setPending(null);
      setNotes("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function click(value: "D" | "ND") {
    if (result?.final_result) {
      setPending({ value, kind: "rehomologate" });
      return;
    }
    if (value === "ND" && opts.nd.exceptional) {
      setPending({ value, kind: "exceptional" });
      return;
    }
    void save(value, "");
  }

  const minChars = ND_EXCEPTIONAL_MIN_CHARS;
  const okText = notes.trim().length >= minChars;
  const size = compact ? "sm" : "default";

  return (
    <div className="space-y-2">
      {result?.final_result && (
        <p className="text-xs">
          Homologado: <span className="font-semibold">{result.final_result}</span>
          {result.confirmed_at && ` em ${new Date(result.confirmed_at).toLocaleString("pt-BR")}`}
        </p>
      )}
      {divergence && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {divergence}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <Button
          size={size}
          variant={result?.final_result === "D" ? "default" : "outline"}
          disabled={!opts.d.allowed || confirm.isPending}
          title={opts.d.reason ?? undefined}
          onClick={() => click("D")}
        >
          {compact ? "D" : "D – Desenvolvido"}
        </Button>
        <Button
          size={size}
          variant={result?.final_result === "ND" ? "default" : "outline"}
          disabled={!opts.nd.allowed || confirm.isPending}
          title={opts.nd.reason ?? undefined}
          onClick={() => click("ND")}
        >
          {compact ? (opts.nd.exceptional ? "ND*" : "ND") : opts.nd.exceptional ? "ND – encerramento excepcional" : "ND – Não Desenvolvido"}
        </Button>
      </div>
      {!compact && (opts.d.reason || opts.nd.reason) && (
        <p className="text-xs text-muted-foreground">{opts.d.reason ?? opts.nd.reason}</p>
      )}

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "rehomologate"
                ? `Nova homologação: ${pending.value}`
                : "Encerramento excepcional em ND"}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "rehomologate"
                ? "Este aluno já tem resultado homologado. A nova decisão substitui a anterior, que continua registrada no histórico de auditoria."
                : "A Recuperação Final ainda não foi avaliada para todos os indicadores em PA/NA. Confirme somente em caso excepcional."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={`Justificativa pedagógica obrigatória (mín. ${minChars} caracteres)`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!okText || confirm.isPending}
              onClick={() => pending && save(pending.value, notes.trim())}
            >
              Confirmar {pending?.value}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
