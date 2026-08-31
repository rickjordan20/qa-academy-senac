import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actionLabel,
  pendingXp,
  sumXp,
  useGamActions,
  useGrantTeamXp,
  useGroupXpEvents,
} from "@/lib/gamification";

/** XP coletivo do Café Central — registrado pelo QA Lead, validado pelo instrutor. */
export function TeamXpCard({ groupId, runId }: { groupId: string; runId: string | null }) {
  const { data: actions } = useGamActions();
  const { data: events } = useGroupXpEvents([groupId]);
  const grant = useGrantTeamXp();
  const [note, setNote] = useState("");

  const collective = (actions ?? []).filter((a) => a.kind === "collective" && a.enabled);
  const approved = sumXp(events, () => true);
  const pending = pendingXp(events);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">XP coletivo do grupo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {approved} XP validado · {pending} XP pendente de validação do instrutor. XP não define
          conceitos A, PA, NA, D ou ND.
        </p>

        <div className="space-y-1">
          <Label htmlFor="team-xp-note">Observação (opcional)</Label>
          <Input
            id="team-xp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: entrega da investigação de checkout"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {collective.map((a) => (
            <Button
              key={a.code}
              size="sm"
              variant="secondary"
              onClick={() =>
                grant.mutate(
                  { groupId, actionCode: a.code, note, refId: runId },
                  {
                    onSuccess: () => {
                      setNote("");
                      toast.success("XP coletivo enviado para validação");
                    },
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
            >
              {a.label} (+{a.xp})
            </Button>
          ))}
        </div>

        <div className="space-y-1 text-xs">
          {(events ?? []).slice(0, 5).map((e) => (
            <div key={e.id} className="flex justify-between rounded-md border border-border p-2">
              <span>{actionLabel(actions, e.action_code)}</span>
              <span className="text-muted-foreground">
                {e.status === "pending" ? "pendente" : e.status === "rejected" ? "não validado" : "validado"} ·
                +{e.xp} XP
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
