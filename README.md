# QA Academy Core

Crie a base funcional da plataforma QA Academy para a UC10 – Realizar testes nas aplicações desenvolvidas.

Objetivo desta etapa:

Construir somente a estrutura principal, autenticação, banco de dados e gestão de usuários/turmas.

Não implemente ainda:

- missões detalhadas;

- gamificação completa;

- Central de Bugs;

- casos de teste;

- avaliação final;

- recuperação;

- relatórios avançados.

Perfis:

1. Instrutor

2. Aluno

Utilize Supabase para autenticação, banco e persistência.

Criar:

1. Login

- e-mail

- senha

- recuperação de senha

2. Perfil

- nome

- e-mail

- avatar opcional

- turma

- perfil

3. Turmas

O instrutor pode:

- criar turma

- editar turma

- cadastrar alunos

- remover alunos

- visualizar integrantes

4. UC10

Cadastrar:

UC10 – Realizar testes nas aplicações desenvolvidas

Indicadores:

I1 – Identifica o tipo de teste conforme demanda.

I2 – Executa teste de carga conforme demanda.

I3 – Executa teste de funcionalidade conforme demanda.

I4 – Executa teste de usabilidade conforme demanda.

I5 – Executa teste estrutural conforme demanda.

I6 – Realiza registro do teste conforme processo estabelecido.

5. Avaliação

Preparar o banco para os únicos conceitos permitidos:

A – Atendido

PA – Parcialmente Atendido

NA – Não Atendido

Resultado final:

D – Desenvolveu

ND – Não Desenvolveu

Não automatizar essas avaliações.

6. Grupos

Criar estrutura básica para:

- grupo

- integrantes

- QA Lead

- funções

Ainda não criar lógica complexa de atividades em grupo.

7. Banco de dados

Criar entidades mínimas equivalentes a:

profiles

classes

enrollments

groups

group_members

indicators

indicator_evaluations

Aplicar segurança para:

- aluno acessar somente seus dados e sua turma

- instrutor acessar as turmas sob sua responsabilidade

8. Dashboard inicial

Aluno:

- nome

- turma

- progresso da UC

- indicadores I1-I6

Instrutor:

- turmas

- alunos

- grupos

- visão inicial dos indicadores

Design:

moderno, tecnológico, simples e responsivo.

Paleta:

azul profundo

azul tecnológico

laranja para destaque

verde para A

amarelo/laranja para PA

vermelho para NA

Priorize funcionamento e banco.

Não gaste esforço com animações ou detalhes visuais nesta etapa.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://qa-academy-senac.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dd01fa76-ecb1-4f8e-a047-b3cffa49d6c3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
