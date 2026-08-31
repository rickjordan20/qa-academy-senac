import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  actionLabel,
  useGamActions,
  useGamSettings,
  usePendingXpQueue,
  useReviewXpEvent,
  useUpdateGamAction,
  useUpdateGamSettings,
} from "@/lib/gamification";

export const Route = createFileRoute("/instructor/gamification")({
  head: () => ({
    meta: [
      { title: "Gamificação | QA Academy" },
      {
        name: "description",
        content: "Configure XP por ação, valide XP pendente e ligue ou desligue os rankings da turma.",
      },
      { property: "og:title", content: "Gamificação | QA Academy" },
      { property: "og:description", content: "Painel do instrutor para XP, badges e rankings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamificationAdmin,
});

function GamificationAdmin() {
  const { data: actions } = useGamActions();
  const { data: settings } = useGamSettings();
  const { data: pending } = usePendingXpQueue();
  const updateAction = useUpdateGamAction();
  const updateSettings = useUpdateGamSettings();
  const review = useReviewXpEvent();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Gamificação</h1>
        <p className="text-sm text-muted-foreground">
          XP e badges são apenas indicadores de prática. Eles não geram e não alteram conceitos A, PA,
          NA, D ou ND.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="rk-ind">Ranking individual visível aos alunos</Label>
            <Switch
              id="rk-ind"
              checked={!!settings?.ranking_individual_enabled}
              onCheckedChange={(v) =>
                updateSettings.mutate({ ranking_individual_enabled: v })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="rk-team">Ranking de equipes visível aos alunos</Label>
            <Switch
              id="rk-team"
              checked={!!settings?.ranking_teams_enabled}
              onCheckedChange={(v) => updateSettings.mutate({ ranking_teams_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>XP pendente de validação ({pending?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(pending ?? []).map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <div>
                <div className="font-semibold">{actionLabel(actions, e.action_code)}</div>
                <div className="text-xs text-muted-foreground">
                  {e.kind === "collective" ? "Coletivo" : "Individual"} ·{" "}
                  {e.context === "cafe" ? "Café Central" : "TechEduca"} · +{e.xp} XP
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    review.mutate(
                      { id: e.id, status: "approved" },
                      { onSuccess: () => toast.success("XP liberado") },
                    )
                  }
                >
                  Liberar XP
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    review.mutate(
                      { id: e.id, status: "rejected" },
                      { onSuccess: () => toast.success("XP não validado") },
                    )
                  }
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))}
          {(pending ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nada pendente no momento.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ações e pontuação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(actions ?? []).map((a) => (
            <div
              key={a.code}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-52">
                <div className="text-sm font-semibold">{a.label}</div>
                <div className="text-xs text-muted-foreground">
                  {a.kind === "collective" ? "Coletivo" : "Individual"} ·{" "}
                  {a.context === "both" ? "Ambas as trilhas" : a.context === "cafe" ? "Café Central" : "TechEduca"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`xp-${a.code}`} className="text-xs">
                    XP
                  </Label>
                  <Input
                    id={`xp-${a.code}`}
                    type="number"
                    className="w-24"
                    defaultValue={a.xp}
                    onBlur={(ev) => {
                      const xp = Number(ev.target.value);
                      if (Number.isFinite(xp) && xp !== a.xp) updateAction.mutate({ code: a.code, patch: { xp } });
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`val-${a.code}`} className="text-xs">
                    Exige validação
                  </Label>
                  <Switch
                    id={`val-${a.code}`}
                    checked={a.requires_validation}
                    onCheckedChange={(v) =>
                      updateAction.mutate({ code: a.code, patch: { requires_validation: v } })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`en-${a.code}`} className="text-xs">
                    Ativa
                  </Label>
                  <Switch
                    id={`en-${a.code}`}
                    checked={a.enabled}
                    onCheckedChange={(v) => updateAction.mutate({ code: a.code, patch: { enabled: v } })}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
