import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ==================================================================== */
/* MOTOR DE MISSÕES — tipos                                             */
/* ==================================================================== */

export type MissionTemplate = "techeduca" | "cafe" | "custom";
export type MissionStatus = "draft" | "published" | "closed" | "archived";
export type ActivityKind = "presencial" | "assincrona" | "final" | "recuperacao";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "url"
  | "select"
  | "multiselect"
  | "checkbox"
  | "scale"
  | "boolean";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[] | undefined;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  description?: string | undefined;
};

export type QuestionDef = FieldDef & { id: string };
export type ChecklistItemDef = { id: string; label: string };

export type BlockFamily = "content" | "answers" | "entries";

export type Section = {
  id: string;
  kind: BlockKind;
  title: string;
  description: string;
  /** conteúdo teórico / instruções (texto rico simples em markdown leve) */
  body?: string | undefined;
  /** itens de material de apoio, perguntas, checklist, campos personalizados, métricas */
  items?: (ChecklistItemDef | QuestionDef | MaterialItem)[] | undefined;
  required: boolean;
  scope: "individual" | "group";
  minItems?: number | undefined;
  maxItems?: number | undefined;
  xp: number;
  indicator_codes: string[];
  visible: boolean;
  /** tipos de evidência aceitos (bloco evidência) */
  accepts?: string[] | undefined;
};

export type MaterialItem = { id: string; label: string; description?: string | undefined; link?: string | undefined };

export type BuilderMission = {
  id: string;
  lesson_number: number | null;
  code: string | null;
  title: string;
  subtitle: string;
  description: string;
  project: string;
  template: MissionTemplate;
  modality: string;
  /** Presencial | Assíncrona | Avaliação Final | Recuperação */
  activity_kind: ActivityKind;
  /** ordem de exibição dentro do tipo (usada nas atividades assíncronas) */
  position: number;
  workload: string;
  objective: string;
  status: MissionStatus;
  opens_at: string | null;
  due_at: string | null;
  base_xp: number;
  badge_code: string | null;
  indicator_codes: string[];
  feature_ids: string[];
  sections: Section[];
  is_library_template: boolean;
  library_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MissionRun = {
  id: string;
  mission_id: string;
  student_id: string | null;
  group_id: string | null;
  status: string;
  progress: number;
  answers: Record<string, unknown>;
  checklist_state: Record<string, boolean>;
  submitted_at: string | null;
  created_at: string;
};

export type MissionEntry = {
  id: string;
  run_id: string;
  mission_id: string;
  section_id: string;
  kind: string;
  author_id: string;
  group_id: string | null;
  parent_id: string | null;
  feature_id: string | null;
  title: string;
  status: string;
  data: Record<string, string>;
  file_path: string | null;
  link: string | null;
  created_at: string;
};

/* ==================================================================== */
/* Catálogo de blocos                                                   */
/* ==================================================================== */

export type BlockKind =
  | "content"
  | "objective"
  | "material"
  | "briefing"
  | "instructions"
  | "checklist"
  | "questions"
  | "custom_fields"
  | "test_case"
  | "execution"
  | "bug"
  | "retest"
  | "usability"
  | "accessibility"
  | "structural"
  | "coverage"
  | "load"
  | "metrics"
  | "evidence"
  | "reflection"
  | "checkpoint"
  | "report"
  | "delivery"
  | "group_task"
  | "responsibilities"
  | "cross_test"
  | "contribution"
  | "group_delivery";

export type BlockDef = {
  kind: BlockKind;
  icon: string;
  label: string;
  family: BlockFamily;
  group: "Conteúdo" | "Interação" | "Técnico" | "Colaborativo" | "Fechamento";
  /** blocos "entries": esquema dos campos de cada registro */
  fields?: FieldDef[];
  /** blocos "answers": esquema fixo de campos de resposta única */
  answerFields?: FieldDef[];
  cafeOnly?: boolean;
  defaultTitle: string;
};

const SEVERITY = ["Baixa", "Média", "Alta", "Crítica"];
const PRIORITY = ["Baixa", "Média", "Alta", "Urgente"];
const BUG_STATUS = [
  "Aberto",
  "Em análise",
  "Confirmado",
  "Em correção",
  "Pronto para reteste",
  "Resolvido",
  "Reaberto",
  "Descartado",
];
const CASE_STATUS = ["Não executado", "Aprovado", "Reprovado", "Bloqueado"];

export const BLOCK_CATALOG: BlockDef[] = [
  { kind: "content", icon: "📖", label: "Conteúdo", family: "content", group: "Conteúdo", defaultTitle: "Conteúdo" },
  { kind: "objective", icon: "🎯", label: "Objetivo", family: "content", group: "Conteúdo", defaultTitle: "Objetivo" },
  { kind: "material", icon: "📚", label: "Material de apoio", family: "content", group: "Conteúdo", defaultTitle: "Material de apoio" },
  { kind: "briefing", icon: "🎬", label: "Briefing / Contexto", family: "content", group: "Conteúdo", defaultTitle: "Briefing" },
  { kind: "instructions", icon: "📋", label: "Instruções", family: "content", group: "Conteúdo", defaultTitle: "Instruções" },

  { kind: "checklist", icon: "☑", label: "Checklist", family: "answers", group: "Interação", defaultTitle: "Checklist" },
  { kind: "questions", icon: "❓", label: "Perguntas", family: "answers", group: "Interação", defaultTitle: "Perguntas" },
  { kind: "custom_fields", icon: "🧩", label: "Campo personalizado", family: "answers", group: "Interação", defaultTitle: "Registro" },
  {
    kind: "reflection",
    icon: "💭",
    label: "Reflexão",
    family: "answers",
    group: "Fechamento",
    defaultTitle: "Reflexão",
  },
  { kind: "checkpoint", icon: "📍", label: "Checkpoint", family: "answers", group: "Fechamento", defaultTitle: "Checkpoint" },
  {
    kind: "report",
    icon: "📝",
    label: "Relatório",
    family: "answers",
    group: "Fechamento",
    defaultTitle: "Relatório",
    answerFields: [
      { key: "resumo", label: "Resumo", type: "textarea" },
      { key: "objetivo", label: "Objetivo", type: "textarea" },
      { key: "escopo", label: "Escopo", type: "textarea" },
      { key: "previstas", label: "Funcionalidades previstas", type: "textarea" },
      { key: "testadas", label: "Funcionalidades testadas", type: "textarea" },
      { key: "nao_testadas", label: "Funcionalidades não testadas", type: "textarea" },
      { key: "adicionais", label: "Funcionalidades adicionais", type: "textarea" },
      { key: "casos", label: "Casos executados", type: "textarea" },
      { key: "resultados", label: "Resultados", type: "textarea" },
      { key: "bugs", label: "Bugs", type: "textarea" },
      { key: "retestes", label: "Retestes", type: "textarea" },
      { key: "metricas", label: "Métricas", type: "textarea" },
      { key: "limitacoes", label: "Limitações", type: "textarea" },
      { key: "conclusao", label: "Conclusão", type: "textarea" },
    ],
  },
  {
    kind: "delivery",
    icon: "📦",
    label: "Entrega",
    family: "answers",
    group: "Fechamento",
    defaultTitle: "Entrega",
    answerFields: [
      { key: "texto", label: "Texto da entrega", type: "textarea" },
      { key: "link", label: "Link", type: "url" },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "group_delivery",
    icon: "👥",
    label: "Entrega do grupo",
    family: "answers",
    group: "Colaborativo",
    cafeOnly: true,
    defaultTitle: "Entrega do grupo",
    answerFields: [
      { key: "responsaveis", label: "Responsáveis pela entrega", type: "text" },
      { key: "resumo", label: "Resumo", type: "textarea" },
      { key: "relatorio", label: "Relatório", type: "textarea" },
      { key: "conclusao", label: "Conclusão", type: "textarea" },
    ],
  },

  {
    kind: "test_case",
    icon: "🧪",
    label: "Caso de teste",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Casos de teste",
    fields: [
      { key: "titulo", label: "Título", type: "text", required: true },
      { key: "funcionalidade", label: "Funcionalidade", type: "text" },
      { key: "objetivo", label: "Objetivo", type: "textarea" },
      { key: "precondicao", label: "Pré-condição", type: "textarea" },
      { key: "dados", label: "Dados de entrada", type: "textarea" },
      { key: "passos", label: "Passos", type: "textarea" },
      { key: "esperado", label: "Resultado esperado", type: "textarea" },
      { key: "obtido", label: "Resultado obtido", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: CASE_STATUS },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "execution",
    icon: "▶",
    label: "Execução de teste",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Execuções",
    fields: [
      { key: "titulo", label: "Caso relacionado", type: "text", required: true },
      { key: "data", label: "Data", type: "date" },
      { key: "ambiente", label: "Ambiente", type: "text" },
      { key: "esperado", label: "Resultado esperado", type: "textarea" },
      { key: "obtido", label: "Resultado obtido", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: CASE_STATUS },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "bug",
    icon: "🐞",
    label: "Bug",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Bugs encontrados",
    fields: [
      { key: "titulo", label: "Título", type: "text", required: true },
      { key: "funcionalidade", label: "Funcionalidade", type: "text" },
      { key: "responsavel", label: "Responsável", type: "text" },
      { key: "descricao", label: "Descrição", type: "textarea" },
      { key: "ambiente", label: "Ambiente", type: "text" },
      { key: "precondicao", label: "Pré-condição", type: "textarea" },
      { key: "passos", label: "Passos para reprodução", type: "textarea" },
      { key: "esperado", label: "Resultado esperado", type: "textarea" },
      { key: "obtido", label: "Resultado obtido", type: "textarea" },
      { key: "severidade", label: "Severidade", type: "select", options: SEVERITY },
      { key: "prioridade", label: "Prioridade", type: "select", options: PRIORITY },
      { key: "status", label: "Status", type: "select", options: BUG_STATUS },
      { key: "caso", label: "Caso relacionado", type: "text" },
    ],
  },
  {
    kind: "retest",
    icon: "🔄",
    label: "Reteste",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Retestes",
    fields: [
      { key: "titulo", label: "Bug relacionado", type: "text", required: true },
      { key: "data", label: "Data", type: "date" },
      { key: "ambiente", label: "Ambiente", type: "text" },
      { key: "procedimento", label: "Procedimento", type: "textarea" },
      { key: "status", label: "Resultado", type: "select", options: ["Resolvido", "Reaberto", "Bloqueado"] },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "usability",
    icon: "🧭",
    label: "Teste de usabilidade",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Teste de usabilidade",
    fields: [
      { key: "titulo", label: "Tarefa", type: "text", required: true },
      { key: "objetivo", label: "Objetivo", type: "textarea" },
      { key: "tela", label: "Funcionalidade / tela", type: "text" },
      { key: "cenario", label: "Cenário", type: "textarea" },
      { key: "esperado", label: "Resultado esperado", type: "textarea" },
      { key: "observado", label: "Comportamento observado", type: "textarea" },
      { key: "dificuldade", label: "Dificuldade encontrada", type: "textarea" },
      { key: "tempo", label: "Tempo (opcional)", type: "text" },
      { key: "problema", label: "Problema", type: "textarea" },
      { key: "sugestao", label: "Sugestão", type: "textarea" },
      { key: "conclusao", label: "Conclusão", type: "textarea" },
    ],
  },
  {
    kind: "accessibility",
    icon: "♿",
    label: "Acessibilidade",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Acessibilidade",
    fields: [
      { key: "titulo", label: "Funcionalidade / tela", type: "text", required: true },
      { key: "elemento", label: "Elemento", type: "text" },
      { key: "criterio", label: "Critério analisado", type: "textarea" },
      { key: "status", label: "Resultado", type: "select", options: ["Conforme", "Parcial", "Não conforme"] },
      { key: "problema", label: "Problema", type: "textarea" },
      { key: "impacto", label: "Impacto", type: "textarea" },
      { key: "recomendacao", label: "Recomendação", type: "textarea" },
    ],
  },
  {
    kind: "structural",
    icon: "🧑‍💻",
    label: "Teste estrutural",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Teste estrutural",
    fields: [
      { key: "titulo", label: "Funcionalidade", type: "text", required: true },
      { key: "arquivo", label: "Arquivo / função analisada", type: "text" },
      { key: "trecho", label: "Trecho ou referência do código", type: "textarea" },
      { key: "condicao", label: "Condição", type: "textarea" },
      { key: "decisao", label: "Decisão", type: "textarea" },
      { key: "caminho", label: "Caminho", type: "textarea" },
      { key: "entrada", label: "Entrada", type: "textarea" },
      { key: "esperado", label: "Saída esperada", type: "textarea" },
      { key: "obtido", label: "Saída obtida", type: "textarea" },
      { key: "status", label: "Resultado", type: "select", options: ["Aprovado", "Reprovado", "Bloqueado"] },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "coverage",
    icon: "🕸",
    label: "Cobertura",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Cobertura",
    fields: [
      { key: "titulo", label: "Funcionalidade", type: "text", required: true },
      { key: "caminho", label: "Condição / caminho", type: "textarea" },
      { key: "caso", label: "Caso relacionado", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Testado", "Parcialmente testado", "Não testado"] },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "load",
    icon: "⚡",
    label: "Teste de carga",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Teste de carga",
    fields: [
      { key: "titulo", label: "Objetivo", type: "text", required: true },
      { key: "recurso", label: "Recurso / rota / endpoint", type: "text" },
      { key: "ferramenta", label: "Ferramenta", type: "text" },
      { key: "cenario", label: "Cenário", type: "textarea" },
      { key: "configuracao", label: "Configuração", type: "textarea" },
      { key: "usuarios", label: "Usuários / requisições", type: "text" },
      { key: "duracao", label: "Duração", type: "text" },
      { key: "ambiente", label: "Ambiente", type: "text" },
      { key: "resultado", label: "Resultado", type: "textarea" },
      { key: "observacao", label: "Observação", type: "textarea" },
      { key: "conclusao", label: "Conclusão", type: "textarea" },
    ],
  },
  {
    kind: "metrics",
    icon: "📊",
    label: "Métricas",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Métricas",
    fields: [
      { key: "titulo", label: "Nome da métrica", type: "text", required: true },
      { key: "valor", label: "Valor", type: "text" },
      { key: "unidade", label: "Unidade", type: "text" },
      { key: "referencia", label: "Referência (opcional)", type: "text" },
      { key: "interpretacao", label: "Interpretação", type: "textarea" },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "evidence",
    icon: "📎",
    label: "Evidência",
    family: "entries",
    group: "Técnico",
    defaultTitle: "Evidências",
    fields: [
      { key: "titulo", label: "Título", type: "text", required: true },
      {
        key: "tipo",
        label: "Tipo",
        type: "select",
        options: [
          "Imagem / Print",
          "Documento / PDF",
          "Vídeo",
          "Log",
          "GitHub / Código",
          "Aplicação publicada",
          "Outro",
        ],
      },
      { key: "url", label: "URL da evidência (https://...)", type: "text" },
      { key: "descricao", label: "Descrição / contexto", type: "textarea", required: true },
      { key: "conteudo", label: "Evidência textual / log (opcional)", type: "textarea" },
      { key: "funcionalidade", label: "Funcionalidade relacionada (opcional)", type: "text" },
      { key: "observacao", label: "Observação (opcional)", type: "textarea" },
    ],
  },
  {
    kind: "group_task",
    icon: "🗂",
    label: "Tarefa do grupo",
    family: "entries",
    group: "Colaborativo",
    cafeOnly: true,
    defaultTitle: "Tarefas do grupo",
    fields: [
      { key: "titulo", label: "Título", type: "text", required: true },
      { key: "descricao", label: "Descrição", type: "textarea" },
      { key: "responsavel", label: "Responsável", type: "text" },
      { key: "colaboradores", label: "Colaboradores", type: "text" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["A fazer", "Em andamento", "Em revisão", "Concluída", "Bloqueada"],
      },
      { key: "prazo", label: "Prazo", type: "date" },
    ],
  },
  {
    kind: "responsibilities",
    icon: "👥",
    label: "Responsabilidades",
    family: "entries",
    group: "Colaborativo",
    cafeOnly: true,
    defaultTitle: "Divisão de responsabilidades",
    fields: [
      { key: "titulo", label: "Integrante", type: "text", required: true },
      { key: "funcao", label: "Função", type: "text" },
      { key: "responsabilidade", label: "Responsabilidade", type: "textarea" },
      { key: "tarefa", label: "Tarefa", type: "text" },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
  {
    kind: "cross_test",
    icon: "🔀",
    label: "Teste cruzado (Dev × Tester)",
    family: "entries",
    group: "Colaborativo",
    cafeOnly: true,
    defaultTitle: "Teste cruzado",
    fields: [
      { key: "titulo", label: "Grupo proprietário", type: "text", required: true },
      { key: "tester", label: "Grupo tester", type: "text" },
      { key: "escopo", label: "Escopo informado", type: "textarea" },
      { key: "funcionalidades", label: "Funcionalidades disponíveis", type: "textarea" },
      { key: "casos", label: "Casos executados", type: "textarea" },
      { key: "bugs", label: "Bugs encontrados", type: "textarea" },
      { key: "devolutiva", label: "Devolutiva", type: "textarea" },
      { key: "correcoes", label: "Correções", type: "textarea" },
      { key: "reteste", label: "Reteste", type: "textarea" },
      { key: "regressao", label: "Regressão", type: "textarea" },
      { key: "conclusao", label: "Conclusão", type: "textarea" },
    ],
  },
  {
    kind: "contribution",
    icon: "👤",
    label: "Contribuição individual",
    family: "entries",
    group: "Colaborativo",
    cafeOnly: true,
    defaultTitle: "Contribuição individual",
    fields: [
      { key: "titulo", label: "Ação realizada", type: "text", required: true },
      { key: "funcao", label: "Função", type: "text" },
      { key: "tarefa", label: "Tarefa", type: "text" },
      { key: "registro", label: "Registro relacionado", type: "text" },
      { key: "observacao", label: "Observação", type: "textarea" },
    ],
  },
];

export function blockDef(kind: string): BlockDef {
  return BLOCK_CATALOG.find((b) => b.kind === kind) ?? BLOCK_CATALOG[0]!;
}

/* ==================================================================== */
/* Presets                                                              */
/* ==================================================================== */

export const PRESETS: { id: string; label: string; blocks: BlockKind[] }[] = [
  { id: "bug_hunt", label: "🐞 Caça aos Bugs", blocks: ["briefing", "checklist", "bug", "evidence", "reflection"] },
  {
    id: "funcional",
    label: "🧪 Teste Funcional",
    blocks: ["objective", "test_case", "execution", "evidence", "reflection"],
  },
  { id: "usabilidade", label: "🧭 Usabilidade", blocks: ["objective", "usability", "evidence", "reflection"] },
  { id: "estrutural", label: "🧑‍💻 Estrutural", blocks: ["objective", "structural", "coverage", "evidence"] },
  { id: "carga", label: "⚡ Carga", blocks: ["objective", "load", "metrics", "evidence", "reflection"] },
  { id: "reteste", label: "🔄 Reteste", blocks: ["bug", "retest", "evidence", "reflection"] },
  { id: "relatorio", label: "📝 Relatório", blocks: ["objective", "report", "evidence", "reflection"] },
  {
    id: "cruzado",
    label: "🔀 Teste Cruzado",
    blocks: ["objective", "cross_test", "test_case", "bug", "retest", "evidence", "reflection"],
  },
];

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function newSection(kind: BlockKind, template: MissionTemplate): Section {
  const def = blockDef(kind);
  return {
    id: uid(),
    kind,
    title: def.defaultTitle,
    description: "",
    body: "",
    items:
      kind === "checklist"
        ? [{ id: uid(), label: "Primeiro item do checklist" }]
        : kind === "questions" || kind === "custom_fields" || kind === "reflection" || kind === "checkpoint"
          ? [{ id: uid(), key: uid(), label: "Pergunta", type: "textarea" as FieldType }]
          : kind === "material"
            ? [{ id: uid(), label: "Material", description: "", link: "" }]
            : [],
    required: true,
    scope: template === "cafe" && def.cafeOnly ? "group" : template === "cafe" ? "group" : "individual",
    minItems: def.family === "entries" ? 1 : undefined,
    xp: 0,
    indicator_codes: [],
    visible: true,
    accepts: undefined,
  };
}

export const TEMPLATE_LABEL: Record<string, string> = {
  techeduca: "🎓 TechEduca — individual guiada",
  cafe: "🚀 Café Central — autônoma em grupo",
  custom: "🧩 Missão personalizada",
};

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  presencial: "🏫 Presencial",
  assincrona: "📚 Assíncrona",
  final: "🎯 Avaliação Final",
  recuperacao: "🛟 Recuperação",
};

export const ACTIVITY_KINDS: ActivityKind[] = ["presencial", "assincrona", "final", "recuperacao"];

/** Situação de uma atividade assíncrona para o aluno. */
export function asyncActivityState(
  mission: Pick<BuilderMission, "status" | "opens_at" | "due_at">,
  run: { submitted_at: string | null; eval_status?: string; progress?: number } | null,
) {
  if (run?.eval_status === "evaluated") return { key: "evaluated", label: "Avaliada", tone: "bg-success/15 text-success" };
  if (run?.submitted_at) return { key: "submitted", label: "Entregue", tone: "bg-accent/15 text-accent" };
  const now = Date.now();
  if (mission.opens_at && new Date(mission.opens_at).getTime() > now)
    return { key: "locked", label: "Bloqueada", tone: "bg-secondary text-muted-foreground" };
  if (mission.status === "closed") return { key: "closed", label: "Encerrada", tone: "bg-secondary text-muted-foreground" };
  if (run) {
    if (mission.due_at && new Date(mission.due_at).getTime() < now)
      return { key: "late", label: "Atrasada", tone: "bg-destructive/15 text-destructive" };
    return { key: "in_progress", label: "Em andamento", tone: "bg-warning/15 text-warning" };
  }
  if (mission.due_at && new Date(mission.due_at).getTime() < now)
    return { key: "late", label: "Atrasada", tone: "bg-destructive/15 text-destructive" };
  return { key: "available", label: "Disponível", tone: "bg-accent/10 text-accent" };
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  closed: "Encerrada",
  archived: "Arquivada",
};

/* ==================================================================== */
/* Progresso                                                            */
/* ==================================================================== */

export function computeProgress(mission: BuilderMission, run: MissionRun | null, entries: MissionEntry[]) {
  const required = (mission.sections ?? []).filter((s) => s.required && s.visible);
  if (!required.length) return run?.submitted_at ? 100 : 0;
  let done = 0;
  for (const s of required) {
    const def = blockDef(s.kind);
    if (def.family === "content") {
      done += 1;
      continue;
    }
    if (s.kind === "checklist") {
      const items = (s.items ?? []) as ChecklistItemDef[];
      const ok = items.length > 0 && items.every((i) => run?.checklist_state?.[i.id]);
      if (ok) done += 1;
      continue;
    }
    if (def.family === "answers") {
      const answers = (run?.answers?.[s.id] ?? {}) as Record<string, string>;
      const keys = def.answerFields?.map((f) => f.key) ?? ((s.items ?? []) as QuestionDef[]).map((q) => q.key);
      const ok = keys.length > 0 && keys.some((k) => (answers?.[k] ?? "").toString().trim().length > 0);
      if (ok) done += 1;
      continue;
    }
    const count = entries.filter((e) => e.section_id === s.id).length;
    if (count >= (s.minItems ?? 1)) done += 1;
  }
  return Math.round((done / required.length) * 100);
}

/* ==================================================================== */
/* Hooks — instrutor                                                    */
/* ==================================================================== */

const MISSION_KEY = ["builder-missions"];

function normalize(row: Record<string, unknown>): BuilderMission {
  return { ...(row as unknown as BuilderMission), sections: (row["sections"] as Section[]) ?? [] };
}

export function useBuilderMissions(options?: { library?: boolean }) {
  const library = options?.library ?? false;
  return useQuery({
    queryKey: [...MISSION_KEY, library ? "library" : "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_missions")
        .select("*")
        .eq("is_library_template", library)
        .order("lesson_number", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => normalize(d as Record<string, unknown>));
    },
  });
}

export function useBuilderMission(id: string | null) {
  return useQuery({
    queryKey: [...MISSION_KEY, "one", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("builder_missions").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data ? normalize(data as Record<string, unknown>) : null;
    },
  });
}

export function useCreateMission(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BuilderMission>) => {
      const { data, error } = await supabase
        .from("builder_missions")
        .insert({
          title: input.title ?? "Nova missão",
          template: input.template ?? "techeduca",
          project: input.project ?? (input.template === "cafe" ? "cafe_central" : "techeduca"),
          modality: input.template === "cafe" ? "grupo" : "individual",
          activity_kind: input.activity_kind ?? "presencial",
          position: input.position ?? 0,
          sections: (input.sections ?? []) as never,
          lesson_number: input.lesson_number ?? null,
          created_by: userId!,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSION_KEY }),
  });
}

export function useUpdateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BuilderMission> }) => {
      const { error } = await supabase.from("builder_missions").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSION_KEY }),
  });
}

export function useDeleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("builder_missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSION_KEY }),
  });
}

/** Duplica estrutura (nunca respostas/evidências/progresso). */
export function useDuplicateMission(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      mission,
      asLibrary,
      name,
    }: {
      mission: BuilderMission;
      asLibrary?: boolean;
      name?: string;
    }) => {
      const { data, error } = await supabase
        .from("builder_missions")
        .insert({
          lesson_number: asLibrary ? null : mission.lesson_number,
          code: null,
          title: name ?? `${mission.title} (cópia)`,
          subtitle: mission.subtitle,
          description: mission.description,
          project: mission.project,
          template: mission.template,
          modality: mission.modality,
          workload: mission.workload,
          objective: mission.objective,
          status: "draft",
          base_xp: mission.base_xp,
          badge_code: mission.badge_code,
          indicator_codes: mission.indicator_codes,
          feature_ids: mission.feature_ids,
          sections: mission.sections as never,
          is_library_template: !!asLibrary,
          library_name: asLibrary ? (name ?? mission.title) : null,
          created_by: userId!,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSION_KEY }),
  });
}

export function useMissionAssignments(missionId: string | null) {
  return useQuery({
    queryKey: ["builder-assignments", missionId],
    enabled: !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_mission_assignments")
        .select("id, class_id")
        .eq("mission_id", missionId!);
      if (error) throw error;
      return (data ?? []) as { id: string; class_id: string }[];
    },
  });
}

export function useSetAssignments(missionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (classIds: string[]) => {
      const { error: delErr } = await supabase
        .from("builder_mission_assignments")
        .delete()
        .eq("mission_id", missionId);
      if (delErr) throw delErr;
      if (classIds.length) {
        const { error } = await supabase
          .from("builder_mission_assignments")
          .insert(classIds.map((class_id) => ({ mission_id: missionId, class_id })) as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-assignments", missionId] }),
  });
}

/** Participação: quantas execuções existem por missão (instrutor). */
export function useMissionParticipation() {
  return useQuery({
    queryKey: ["builder-participation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_mission_runs")
        .select("id, mission_id, progress, status");
      if (error) throw error;
      const map: Record<string, { runs: number; done: number }> = {};
      for (const r of (data ?? []) as { mission_id: string; status: string }[]) {
        const m = (map[r.mission_id] ??= { runs: 0, done: 0 });
        m.runs += 1;
        if (r.status === "completed") m.done += 1;
      }
      return map;
    },
  });
}

export function useMissionRunsForInstructor(missionId: string | null) {
  return useQuery({
    queryKey: ["builder-runs", missionId],
    enabled: !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_mission_runs")
        .select("*")
        .eq("mission_id", missionId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MissionRun[];
    },
  });
}

/* ==================================================================== */
/* Hooks — aluno                                                        */
/* ==================================================================== */

export function useStudentMissions() {
  return useQuery({
    queryKey: ["builder-student-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_missions")
        .select("*")
        .in("status", ["published", "closed"])
        .order("lesson_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((d) => normalize(d as Record<string, unknown>));
    },
  });
}

export function useMyRun(mission: BuilderMission | null, userId: string | null, groupId: string | null) {
  return useQuery({
    queryKey: ["builder-run", mission?.id, userId, groupId],
    enabled: !!mission && !!userId && (mission.template !== "cafe" || !!groupId),
    queryFn: async () => {
      let q = supabase.from("builder_mission_runs").select("*").eq("mission_id", mission!.id);
      q = mission!.template === "cafe" ? q.eq("group_id", groupId!) : q.eq("student_id", userId!);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data as unknown as MissionRun) ?? null;
    },
  });
}

export function useStartRun(mission: BuilderMission, userId: string, groupId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const payload =
        mission.template === "cafe"
          ? { mission_id: mission.id, group_id: groupId, student_id: null, created_by: userId }
          : { mission_id: mission.id, student_id: userId, group_id: null, created_by: userId };
      const { data, error } = await supabase
        .from("builder_mission_runs")
        .insert(payload as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as MissionRun;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-run", mission.id] }),
  });
}

export function useSaveRun(missionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, patch }: { runId: string; patch: Partial<MissionRun> }) => {
      const { error } = await supabase.from("builder_mission_runs").update(patch as never).eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-run", missionId] }),
  });
}

export function useRunEntries(runId: string | null) {
  return useQuery({
    queryKey: ["builder-entries", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_mission_entries")
        .select("*")
        .eq("run_id", runId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MissionEntry[];
    },
  });
}

export function useCreateEntry(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      missionId: string;
      sectionId: string;
      kind: string;
      authorId: string;
      groupId: string | null;
      title: string;
      status: string;
      data: Record<string, string>;
      link?: string | null;
    }) => {
      const { data, error } = await supabase.from("builder_mission_entries").insert({
        run_id: runId,
        mission_id: input.missionId,
        section_id: input.sectionId,
        kind: input.kind,
        author_id: input.authorId,
        group_id: input.groupId,
        title: input.title,
        status: input.status,
        data: input.data as never,
        link: input.link ?? null,
        file_path: null,
      } as never).select("id").maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null)?.id ?? null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-entries", runId] }),
  });
}

export function useDeleteEntry(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("builder_mission_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-entries", runId] }),
  });
}

/** XP do motor: conclusão automática e entregas pendentes de validação. */
export async function awardMissionXp(params: {
  studentId: string;
  groupId: string | null;
  context: "techeduca" | "cafe";
  action: "builder_mission_complete" | "builder_block_submit";
  refId: string;
  note: string;
}) {
  await supabase.from("gam_xp_events").insert({
    student_id: params.studentId,
    group_id: params.groupId,
    context: params.context,
    kind: "individual",
    action_code: params.action,
    xp: 0,
    ref_kind: "builder_mission",
    ref_id: params.refId,
    note: params.note,
  } as never);
}

export async function signedEvidenceUrl(path: string) {
  const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}


/** XP coletivo do grupo pela missão do Café Central (uma vez por ação/execução). */
export async function awardGroupMissionXp(params: {
  groupId: string;
  action: "cafe_collaboration" | "cafe_mission_delivered";
  refId: string;
  note: string;
}) {
  await supabase.from("gam_xp_events").insert({
    group_id: params.groupId,
    context: "cafe",
    kind: "collective",
    action_code: params.action,
    xp: 0,
    ref_kind: "group_run",
    ref_id: params.refId,
    note: params.note,
  } as never);
}
