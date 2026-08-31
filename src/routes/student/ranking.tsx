import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGamSettings, useIndividualRanking, useTeamRanking } from "@/lib/gamification";

export const Route = createFileRoute("/student/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking QA | QA Academy" },
      {
        name: "description",
        content: "Ranking opcional de XP individual e por equipe, sem qualquer relação com a avaliação da UC10.",
      },
      { property: "og:title", content: "Ranking QA | QA Academy" },
      { property: "og:description", content: "Veja o ranking de XP individual e de equipes da turma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RankingPage,
});

function RankingPage() {
  const { user } = useAuth();
  const { data: settings } = useGamSettings();
  const individualOn = !!settings?.ranking_individual_enabled;
  const teamsOn = !!settings?.ranking_teams_enabled;
  const { data: individual } = useIndividualRanking(individualOn);
  const { data: teams } = useTeamRanking(teamsOn);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Ranking</h1>
        <p className="text-sm text-muted-foreground">
          O ranking usa apenas XP de prática. Ele não representa e não influencia os conceitos A, PA,
          NA, D ou ND da UC10.
        </p>
      </div>

      {!individualOn && !teamsOn && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            O ranking está desativado pelo professor.
          </CardContent>
        </Card>
      )}

      {individualOn && (
        <Card>
          <CardHeader>
            <CardTitle>Individual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(individual ?? []).map((row, i) => (
              <div
                key={row.student_id}
                className={`flex items-center justify-between rounded-lg border p-2 text-sm ${
                  row.student_id === user?.id ? "border-accent bg-secondary" : "border-border"
                }`}
              >
                <span>
                  <span className="mr-3 font-semibold text-muted-foreground">{i + 1}º</span>
                  {row.full_name}
                </span>
                <span className="font-semibold">{row.xp} XP</span>
              </div>
            ))}
            {(individual ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Ainda não há XP validado.</p>
            )}
          </CardContent>
        </Card>
      )}

      {teamsOn && (
        <Card>
          <CardHeader>
            <CardTitle>Equipes (Café Central)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(teams ?? []).map((row, i) => (
              <div
                key={row.group_id}
                className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
              >
                <span>
                  <span className="mr-3 font-semibold text-muted-foreground">{i + 1}º</span>
                  {row.group_name}
                </span>
                <span className="font-semibold">{row.xp} XP</span>
              </div>
            ))}
            {(teams ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Ainda não há XP coletivo validado.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
