import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useBadgeAwards,
  useBadgeCatalog,
  useMissionsByBadge,
  useUpdateBadge,
  type Badge,
} from "@/lib/gamification";

export const Route = createFileRoute("/instructor/badges")({
  head: () => ({
    meta: [
      { title: "Badges | QA Academy" },
      {
        name: "description",
        content: "Catálogo de badges da UC10: critérios, conquistas por aluno e missões relacionadas.",
      },
      { property: "og:title", content: "Badges | QA Academy" },
      { property: "og:description", content: "Painel do instrutor para o catálogo de badges da QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BadgesAdmin,
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function BadgeCard({
  badge,
  awards,
  missions,
}: {
  badge: Badge;
  awards: { name: string; awarded_at: string }[];
  missions: { id: string; title: string }[];
}) {
  const update = useUpdateBadge();
  const [editing, setEditing] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [draft, setDraft] = useState({
    name: badge.name,
    description: badge.description,
    criteria: badge.criteria,
    position: badge.position,
  });

  const save = () => {
    update.mutate(
      { code: badge.code, patch: draft },
      {
        onSuccess: () => {
          toast.success("Badge atualizado");
          setEditing(false);
        },
        onError: () => toast.error("Não foi possível salvar o badge"),
      },
    );
  };

  return (
    <Card className={badge.enabled ? "" : "opacity-70"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>
            {badge.icon} {badge.name}
          </span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            {badge.enabled ? "Ativo" : "Inativo"}
            <Switch
              checked={badge.enabled}
              onCheckedChange={(v) =>
                update.mutate(
                  { code: badge.code, patch: { enabled: v } },
                  { onError: () => toast.error("Não foi possível alterar o status") },
                )
              }
            />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {editing ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Critério (texto descritivo)</Label>
              <Textarea
                rows={2}
                value={draft.criteria}
                onChange={(e) => setDraft({ ...draft, criteria: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Posição</Label>
              <Input
                type="number"
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={update.isPending}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">{badge.description}</p>
            <p>
              <span className="text-xs uppercase text-muted-foreground">Critério</span>
              <br />
              {badge.criteria || "—"}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Código: {badge.code}</span>
              <span>Posição: {badge.position}</span>
              <span>{awards.length} aluno(s) conquistaram</span>
              <span>{missions.length} missão(ões) relacionada(s)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPeople((v) => !v)}>
                {showPeople ? "Ocultar detalhes" : "Ver alunos e missões"}
              </Button>
            </div>
            {showPeople ? (
              <div className="grid gap-3 rounded-md border border-border p-3 text-xs md:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold">Alunos que conquistaram</p>
                  {awards.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum aluno ainda.</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {awards.map((a, i) => (
                        <li key={`${a.name}-${i}`}>
                          {a.name} — {new Date(a.awarded_at).toLocaleDateString("pt-BR")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-1 font-semibold">Missões relacionadas</p>
                  {missions.length === 0 ? (
                    <p className="text-muted-foreground">Nenhuma missão relacionada.</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {missions.map((m) => (
                        <li key={m.id}>{m.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BadgesAdmin() {
  const { data: catalog } = useBadgeCatalog();
  const { data: awards } = useBadgeAwards();
  const { data: missions } = useMissionsByBadge();

  const awardsByBadge = useMemo(() => {
    const map = new Map<string, { name: string; awarded_at: string }[]>();
    for (const a of awards ?? []) {
      const list = map.get(a.badge_code) ?? [];
      list.push({ name: a.name, awarded_at: a.awarded_at });
      map.set(a.badge_code, list);
    }
    return map;
  }, [awards]);

  const missionsByBadge = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    for (const m of missions ?? []) {
      const list = map.get(m.badge_code) ?? [];
      list.push({ id: m.id, title: m.title });
      map.set(m.badge_code, list);
    }
    return map;
  }, [missions]);

  const students = new Set((awards ?? []).map((a) => a.student_id)).size;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de conquistas da QA Academy. Badges não definem A/PA/NA nem D/ND.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Badges cadastrados" value={(catalog ?? []).length} />
        <Stat label="Conquistas realizadas" value={(awards ?? []).length} />
        <Stat label="Alunos com badges" value={students} />
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        O texto do critério é apenas a <strong>descrição</strong> da regra automática. A concessão continua sendo
        calculada pelo sistema a partir dos registros reais do aluno (casos, execuções, bugs, evidências, retestes,
        contribuições e liderança de grupo). Editar esse texto não altera a regra.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(catalog ?? []).map((b) => (
          <BadgeCard
            key={b.code}
            badge={b}
            awards={awardsByBadge.get(b.code) ?? []}
            missions={missionsByBadge.get(b.code) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
