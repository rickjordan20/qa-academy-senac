import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  ClipboardList,
  Coffee,
  GraduationCap,
  ListChecks,
  Sparkles,
  Trophy,
  XCircle,
  CheckCircle2,
  Target,
  ZoomIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useAcknowledgeEvaluation,
  useMyEvaluationAck,
} from "@/lib/assessment";
import { ConceptBadge } from "@/components/ConceptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import infographic from "@/assets/como-aluno-sera-avaliado.png.asset.json";

export const Route = createFileRoute("/student/how-evaluated")({
  head: () => ({
    meta: [
      { title: "Como você será avaliado | QA Academy" },
      {
        name: "description",
        content:
          "Entenda de forma simples como funciona a avaliação da UC10: missões, conceitos A/PA/NA, indicadores I1–I6, avaliação final e XP.",
      },
      { property: "og:title", content: "Como você será avaliado | QA Academy" },
      {
        property: "og:description",
        content: "Na QA Academy você aprende na prática e é avaliado pelo que faz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowEvaluatedPage,
});

function Step({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {number}
          </span>
          <Icon className="h-5 w-5 shrink-0 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}

function HowEvaluatedPage() {
  const { user } = useAuth();
  const { data: ack } = useMyEvaluationAck(user?.id ?? null);
  const acknowledge = useAcknowledgeEvaluation(user?.id ?? null);
  const [confirming, setConfirming] = useState(false);

  async function handleAcknowledge() {
    try {
      await acknowledge.mutateAsync();
      toast.success("Ciência registrada. Boa jornada na UC10!");
      setConfirming(false);
    } catch {
      toast.error("Não foi possível registrar sua ciência. Tente novamente.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">Como você será avaliado?</h1>
        <p className="mt-1 text-muted-foreground">Entenda de forma simples e clara!</p>
        <p className="mx-auto mt-3 max-w-xl rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium">
          Na QA Academy, você aprende na prática e é avaliado pelo que faz.
        </p>
        <p className="mt-3 text-xs italic text-muted-foreground">
          Mais do que notas, aqui você desenvolve habilidades reais para a sua carreira!
        </p>
      </div>

      {/* Infográfico original */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            Infográfico oficial
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <ZoomIn className="mr-1 h-4 w-4" /> Ampliar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogTitle>Como você será avaliado — UC10</DialogTitle>
                <img
                  src={infographic.url}
                  alt="Infográfico: Como você será avaliado na UC10 da QA Academy"
                  className="w-full rounded-lg"
                />
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <img
            src={infographic.url}
            alt="Infográfico: Como você será avaliado na UC10 da QA Academy"
            className="w-full rounded-lg border border-border"
            loading="lazy"
          />
        </CardContent>
      </Card>

      {/* Passos 1–9 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Step number={1} icon={ClipboardList} title="Realize as missões">
          <p className="text-muted-foreground">
            Coloque em prática o que aprendeu!
          </p>
          <ul className="space-y-1">
            <Check>Responda atividades</Check>
            <Check>Crie casos de teste</Check>
            <Check>Registre bugs</Check>
            <Check>Anexe evidências (prints, links, etc.)</Check>
            <Check>Entregue no prazo</Check>
          </ul>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            Tudo o que você faz fica registrado na plataforma.
          </p>
        </Step>

        <Step number={2} icon={BadgeCheck} title="O instrutor avalia sua entrega">
          <p className="text-muted-foreground">
            Ele analisa suas evidências e dá um conceito em cada parte da missão:
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ConceptBadge concept="A" /> <span>Atende totalmente</span>
            </div>
            <div className="flex items-center gap-2">
              <ConceptBadge concept="PA" /> <span>Atende parcialmente</span>
            </div>
            <div className="flex items-center gap-2">
              <ConceptBadge concept="NA" /> <span>Não atende</span>
            </div>
          </div>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            Você também recebe um <strong>feedback</strong> com orientações para melhorar!
          </p>
        </Step>

        <Step number={3} icon={ListChecks} title="Acompanhe seu progresso">
          <p className="text-muted-foreground">
            Veja suas notas, feedbacks e evolução na sua área do aluno:
          </p>
          <ul className="space-y-1">
            <Check>Suas notas (A/PA/NA)</Check>
            <Check>Feedbacks do instrutor</Check>
            <Check>Seu progresso nos indicadores (I1–I6)</Check>
            <Check>XP e badges conquistados</Check>
          </ul>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            <strong>PA ou NA não é o fim!</strong> Você terá novas oportunidades para aprender
            e mostrar que evoluiu.
          </p>
        </Step>

        <Step number={4} icon={Target} title="Melhore e tente novamente">
          <p className="text-muted-foreground">
            Recebeu <strong>PA</strong> ou <strong>NA</strong>? Sem problema! Isso faz parte
            da sua aprendizagem.
          </p>
          <ul className="space-y-1">
            <Check>Reenvie a missão (quando permitido)</Check>
            <Check>Estude e pratique mais</Check>
            <Check>Aplique as orientações do feedback</Check>
            <Check>Mostre novas evidências</Check>
          </ul>
          <p className="rounded-md bg-surface p-2 text-xs italic text-muted-foreground">
            "Errar, corrigir e evoluir faz parte do processo!"
          </p>
        </Step>

        <Step number={5} icon={Coffee} title="Missões em grupo">
          <p className="text-muted-foreground">
            Todos do grupo recebem a mesma nota da missão, mas sua participação individual é
            registrada.
          </p>
          <p className="font-medium">O instrutor analisa:</p>
          <ul className="space-y-1">
            <Check>Quais tarefas foram atribuídas</Check>
            <Check>Quem realmente realizou</Check>
            <Check>Suas contribuições e evidências</Check>
            <Check>A participação de cada integrante</Check>
          </ul>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            A nota pode ser ajustada individualmente quando houver evidências que justifiquem.
          </p>
        </Step>

        <Step number={6} icon={GraduationCap} title="Avaliação Final (Aula 21)">
          <p className="text-muted-foreground">
            O instrutor analisa todo o seu percurso na UC10:
          </p>
          <ul className="space-y-1">
            <Check>Histórico das suas missões</Check>
            <Check>Evolução dos indicadores (I1–I6)</Check>
            <Check>Qualidade das evidências</Check>
            <Check>Avaliação Final</Check>
          </ul>
          <p className="font-medium">Cada indicador recebe apenas:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ConceptBadge concept="A" /> <span>Atendido</span>
            </div>
            <div className="flex items-center gap-2">
              <ConceptBadge concept="NA" /> <span>Não atendido</span>
            </div>
          </div>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            Todos os indicadores <strong>A</strong> → Conceito <strong>D</strong>{" "}
            (Desenvolvido). Se houver algum <strong>NA</strong> → você vai para a{" "}
            <strong>Recuperação Final</strong>.
          </p>
        </Step>

        <Step number={7} icon={ListChecks} title="Recuperação Final">
          <p className="text-muted-foreground">
            Ainda ficou algum indicador <strong>NA</strong>? Você terá uma nova oportunidade!
          </p>
          <ul className="space-y-1">
            <Check>Realize as atividades de recuperação</Check>
            <Check>Foque nos indicadores pendentes</Check>
            <Check>Envie suas novas evidências</Check>
            <Check>O instrutor avalia novamente</Check>
          </ul>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            Após a recuperação: todos <strong>A</strong> → <strong>D</strong> (Desenvolvido).
            Se ainda houver algum <strong>NA</strong> → <strong>ND</strong> (Não Desenvolvido).
          </p>
        </Step>

        <Step number={8} icon={BadgeCheck} title="Resultado final da UC10">
          <p className="text-muted-foreground">
            O resultado é manual, confirmado pelo instrutor, com base em tudo o que você
            realizou.
          </p>
          <ul className="space-y-1">
            <Check>
              <span>
                <strong>D</strong> – Desenvolvido (competência alcançada)
              </span>
            </Check>
            <li className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>
                <strong>ND</strong> – Não Desenvolvido (competência não alcançada)
              </span>
            </li>
          </ul>
        </Step>

        <Step number={9} icon={Trophy} title="XP e badges (motivação extra!)">
          <p className="text-muted-foreground">
            Você ganha XP por suas atividades na plataforma (entregas, participação,
            colaboração, etc.) e conquista badges.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["QA Rookie", "QA Júnior", "QA Pleno", "QA Sênior", "QA Especialista", "QA Master"].map(
              (n, i) => (
                <Badge key={n} variant="secondary">
                  {i + 1}. {n}
                </Badge>
              ),
            )}
          </div>
          <p className="rounded-md bg-surface p-2 text-xs text-muted-foreground">
            <strong>XP não é nota!</strong> Eles reconhecem seu esforço e incentivam sua
            jornada, mas não influenciam no conceito A/PA/NA ou no resultado final da UC.
          </p>
        </Step>
      </div>

      {/* Blocos finais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-accent" /> O que você pode acompanhar?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <Check>Status das suas missões (pendente, enviada, avaliada)</Check>
              <Check>Notas e feedbacks de cada entrega</Check>
              <Check>Seu progresso nos indicadores (I1–I6)</Check>
              <Check>Seu XP, níveis e badges</Check>
              <Check>Todo o seu histórico de atividades</Check>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-accent" /> Nosso objetivo é o seu crescimento!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Aqui, mais importante do que a nota é o que você aprende ao longo do caminho.
              As avaliações existem para mostrar o seu progresso, identificar o que precisa
              melhorar e te preparar para desafios reais no mercado de trabalho.
            </p>
            <p className="rounded-md bg-surface p-2 text-xs italic text-muted-foreground">
              "Errar, corrigir e aprender faz parte do processo. Você não está sozinho!"
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-accent" /> Em resumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <Check>Você é avaliado pelo que faz, não apenas por provas.</Check>
              <Check>As notas seguem critérios claros e justos.</Check>
              <Check>Seu esforço e participação são reconhecidos com XP e badges.</Check>
              <Check>
                Em grupo, todos recebem a mesma nota, mas sua contribuição individual é
                registrada.
              </Check>
              <Check>Você pode acompanhar tudo na sua área do aluno.</Check>
              <Check>
                O objetivo é te ajudar a evoluir e se tornar um profissional melhor!
              </Check>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Ciência */}
      <Card className="border-accent/50">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          {ack ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-accent" />
              <p className="font-medium">
                Ciência registrada em{" "}
                {new Date(ack.acknowledged_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
              <p className="text-sm text-muted-foreground">
                Você confirmou que entendeu como será avaliado na UC10.
              </p>
            </>
          ) : confirming ? (
            <>
              <p className="font-medium">
                Você confirma que leu e compreendeu como será avaliado na UC10?
              </p>
              <div className="flex gap-2">
                <Button onClick={() => void handleAcknowledge()} disabled={acknowledge.isPending}>
                  {acknowledge.isPending ? "Registrando..." : "Sim, confirmo"}
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Voltar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium">Leu todo o conteúdo acima?</p>
              <p className="text-sm text-muted-foreground">
                Confirme sua ciência para registrar que você entendeu como será avaliado.
              </p>
              <Button size="lg" onClick={() => setConfirming(true)}>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Li e compreendi como serei avaliado
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
