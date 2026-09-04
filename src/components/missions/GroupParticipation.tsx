import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { blockDef } from "@/lib/mission-builder";
import { fmtDateTime } from "@/lib/mission-submissions";
import { taskStatusLabel } from "@/lib/cafe";
import {
  STATE_LABEL,
  STATE_TONE,
  useGroupParticipation,
  type MemberParticipation,
  type ParticipationState,
} from "@/lib/mission-participation";

function StateTag({ state }: { state: ParticipationState }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_TONE[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

function MemberDetail({ m }: { m: MemberParticipation }) {
  const kinds = Object.entries(m.byKind);
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface p-3 text-xs">
      <p className="text-sm font-semibold">Participação de {m.name}</p>
      <p className="text-muted-foreground">Função no grupo: {m.role}</p>

      <div>
        <p className="font-semibold">Tarefas atribuídas ({m.assignedTasks.length})</p>
        {m.assignedTasks.length === 0 ? <p className="text-muted-foreground">Nenhuma.</p> : null}
        {m.assignedTasks.map((t) => (
          <p key={t.id}>
            • {t.title} — {taskStatusLabel(t.status)}
            {t.section_id ? "" : " · Tarefa livre"}
          </p>
        ))}
      </div>

      <div>
        <p className="font-semibold">Contribuições individuais ({m.contributions.length})</p>
        {m.contributions.length === 0 ? <p className="text-muted-foreground">Nenhuma.</p> : null}
        {m.contributions.map((c) => (
          <p key={c.id}>
            • {c.title || "Contribuição"} · {c.scope === "group" ? "coletiva" : "individual"} ·{" "}
            {fmtDateTime(c.created_at)}
          </p>
        ))}
      </div>

      <div>
        <p className="font-semibold">Registros da missão ({m.entries.length})</p>
        {kinds.length === 0 ? <p className="text-muted-foreground">Nenhum registro.</p> : null}
        {kinds.map(([kind, list]) => (
          <div key={kind}>
            <p className="mt-1">
              {blockDef(kind).icon} {blockDef(kind).label} ({list.length})
            </p>
            {list.map((e) => (
              <p key={e.id} className="text-muted-foreground">
                – {e.title || blockDef(e.kind).label} · {fmtDateTime(e.created_at)}
                {e.link ? (
                  <>
                    {" · "}
                    <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      abrir
                    </a>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        ))}
      </div>

      <p className="text-muted-foreground">
        Última atividade registrada na missão: {m.lastActivity ? fmtDateTime(m.lastActivity) : "—"}
      </p>
    </div>
  );
}

export function GroupParticipation({ runId }: { runId: string }) {
  const { data, isPending } = useGroupParticipation(runId);
  const [open, setOpen] = useState<string | null>(null);

  if (isPending) return null;
  if (!data) return null;

  return (
    <div className="max-w-4xl space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Divisão de tarefas e participação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Grupo {data.groupName} · QA Líder: {data.leadName ?? "não definido"} ·{" "}
            {data.submittedByName ? `Envio realizado por: ${data.submittedByName}` : "Envio não realizado"}
            {data.submittedAt ? ` (${fmtDateTime(data.submittedAt)})` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Atribuição não é prova de execução: a participação abaixo vem apenas de registros reais.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1">Aluno</th>
                  <th>Função</th>
                  <th>Tarefas</th>
                  <th>Blocos</th>
                  <th>Realizados</th>
                  <th>Contrib.</th>
                  <th>Evidências</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-1">
                      <button
                        type="button"
                        onClick={() => setOpen(open === m.id ? null : m.id)}
                        className="font-semibold hover:underline"
                      >
                        {open === m.id ? "▾" : "▸"} {m.name}
                      </button>
                    </td>
                    <td>{m.role}</td>
                    <td>{m.assignedTasks.length}</td>
                    <td>{m.assignedSectionIds.length}</td>
                    <td>{m.doneSectionIds.length}</td>
                    <td>{m.contributions.length}</td>
                    <td>{m.evidences.length}</td>
                    <td>
                      <StateTag state={m.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Este grupo ainda não possui integrantes cadastrados.</p>
          ) : null}

          {data.members
            .filter((m) => m.id === open)
            .map((m) => (
              <MemberDetail key={m.id} m={m} />
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Divisão original do trabalho</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa foi distribuída nesta missão.</p>
          ) : null}
          {data.tasks.map(({ task, sectionTitle, owners, createdByName, doneAt }) => (
            <div key={task.id} className="rounded-md border border-border p-3 text-xs">
              <p className="text-sm font-semibold">{task.title}</p>
              <p className="text-muted-foreground">{sectionTitle ? `Bloco: ${sectionTitle}` : "Tarefa livre"}</p>
              <p>
                Responsável(is):{" "}
                {owners.length ? owners.map((o) => `${o.name} (${o.role})`).join(", ") : "Não atribuída"}
              </p>
              <p className="text-muted-foreground">
                Status: {taskStatusLabel(task.status)} · Criada em {fmtDateTime(task.created_at)} por {createdByName}
                {doneAt ? ` · Concluída em ${fmtDateTime(doneAt)}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rastreabilidade por bloco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.sections.map((s) => (
            <div key={s.section.id} className="rounded-md border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {blockDef(s.section.kind).icon} {s.section.title}
                </p>
                <StateTag state={s.state} />
              </div>
              <p className="mt-1">
                Atribuído a: {s.assigned.length ? s.assigned.map((a) => a.name).join(", ") : "ninguém"}
              </p>
              <p>
                Realizado por:{" "}
                {s.performed.length
                  ? s.performed.map((p) => `${p.name} (${fmtDateTime(p.at)})`).join(", ")
                  : "sem registro"}
              </p>
              {s.assigned
                .filter((a) => !s.performed.some((p) => p.id === a.id))
                .map((a) => (
                  <p key={a.id} className="text-muted-foreground">
                    {a.name} ○ Sem registro neste bloco
                  </p>
                ))}
              {s.tasks.map((t) => (
                <p key={t.id} className="text-muted-foreground">
                  Tarefa relacionada: {t.title} — {taskStatusLabel(t.status)}
                </p>
              ))}
              {s.entries.map((e) => (
                <p key={e.id} className="text-muted-foreground">
                  Registro: {e.title || blockDef(e.kind).label} · {fmtDateTime(e.created_at)}
                  {e.link ? (
                    <>
                      {" · "}
                      <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        evidência
                      </a>
                    </>
                  ) : null}
                </p>
              ))}
              {s.contributions.map((c) => (
                <p key={c.id} className="text-muted-foreground">
                  Contribuição: {c.title || "registro"} · {fmtDateTime(c.created_at)}
                </p>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico de tentativas do grupo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum envio registrado até o momento.</p>
          ) : null}
          {data.attempts.map((a, i) => (
            <div key={`${a.attempt}-${i}`} className="rounded-md border border-border p-3 text-xs">
              <p className="text-sm font-semibold">Tentativa {a.attempt}</p>
              <p>
                {a.kind === "resubmitted" ? "Reenviada por" : "Enviada por"}: {a.actorName}
              </p>
              <p className="text-muted-foreground">Data/hora: {fmtDateTime(a.at)}</p>
              <p className="text-muted-foreground">
                Integrantes do grupo: {data.members.map((m) => m.name).join(", ") || "—"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
