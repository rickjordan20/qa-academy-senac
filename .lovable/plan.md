# Padronizar formatação Markdown simples nos blocos de missão

Hoje só o campo "Texto" dos blocos de conteúdo usa o mini-Markdown (`## título`, `- lista`), renderizado pelo componente interno `RichText` do player de missões. Todos os outros textos longos (descrição do bloco, material de apoio, orientações de perguntas/campos, valores de registros) aparecem como texto cru.

## O que muda

1. **Componente único e reutilizável**
   Extrair o `RichText` já existente do player para um componente próprio (`src/components/missions/RichText.tsx`), sem mudar as regras atuais: `## ` vira título, `- ` vira item de lista, linhas em branco viram parágrafo, quebras de linha preservadas. Continua sendo texto puro em React — nada de HTML arbitrário, nada de `dangerouslySetInnerHTML`, então a sanitização atual permanece por construção.

2. **Visão do aluno (e telas de leitura das missões)**
   Passar a renderizar com esse componente:
   - descrição/orientação do bloco (vale para todos os tipos: checklist, perguntas, reflexão, checkpoint, relatório, entrega, evidência, bug, caso de teste, execução, reteste, usabilidade, acessibilidade, estrutural, cobertura, carga, métricas etc.);
   - corpo dos blocos de conteúdo/briefing/instruções/objetivo (já funciona, passa a usar o componente compartilhado);
   - descrição dos itens de material de apoio;
   - textos de ajuda/descrição de perguntas e campos personalizados;
   - valores longos exibidos nos registros já salvos (campos do tipo texto longo), hoje mostrados crus.

3. **Interface do instrutor**
   Nos campos compatíveis do editor de blocos, exibir a mesma dica já usada no campo "Texto": "Use ## para títulos e - para listas." Aplicar em descrição/orientação do bloco, descrição de material de apoio e descrição de perguntas/campos. Sem editor visual novo.

4. **Campos que ficam de fora**
   Título do bloco, XP, mín./máx., opções de seleção, datas, indicadores, escopo e status continuam texto simples, sem Markdown.

## Compatibilidade

Nada é alterado no banco nem no conteúdo já cadastrado. Textos antigos sem marcação continuam iguais; textos que já usam `##` e `-` passam a ser exibidos formatados nos demais blocos.

## Detalhes técnicos

- Novo arquivo: `src/components/missions/RichText.tsx` (move a função existente de `MissionPlayer.tsx`).
- Edições: `src/components/missions/MissionPlayer.tsx` (descrição, material, campos, valores de registros), `src/components/missions/DynamicFields.tsx` (`field.description` renderizado com o componente), `src/components/missions/SectionEditor.tsx` (textos de ajuda).
- Sem mudança de rotas, RLS, XP, avaliação ou fluxo de envio.

## Validação

Revisar no preview um bloco de cada tipo listado (briefing, material, instruções, checklist, perguntas, reflexão, checkpoint, evidência, bug, relatório, entrega) com um texto de exemplo contendo `## título`, parágrafo e lista, conferindo que o aluno vê formatado e o instrutor vê a dica.
