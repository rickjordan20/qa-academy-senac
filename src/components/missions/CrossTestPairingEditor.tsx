import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { useCrossGroups, useCrossPairings, useRemovePairing, useSavePairing } from "@/lib/cross-test";

/** Configuração dos pareamentos Tester → Desenvolvedor de um bloco de teste cruzado. */
export function CrossTestPairingEditor({
  missionId,
  sectionId,
  classIds,
}: {
  missionId: string;
  sectionId: string;
  classIds: string[];
}) {
  const { data: pairings } = useCrossPairings(missionId);
  const { data: groups } = useCrossGroups(classIds);
  const save = useSavePairing(missionId);
  const remove = useRemovePairing(missionId);

  const [tester, setTester] = useState("");
  const [developer, setDeveloper] = useState("");

  const rows = useMemo(
    () => (pairings ?? []).filter((p) => p.section_id === sectionId),
    [pairings, sectionId],
  );
  const groupName = (id: string) => (groups ?? []).find((g) => g.id === id)?.name ?? "Grupo";
  const testerGroup = (groups ?? []).find((g) => g.id === tester) ?? null;
  const devOptions = (groups ?? []).filter(
    (g) => g.id !== tester && (!testerGroup || g.class_id === testerGroup.class_id),
  );

  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Pareamentos do teste cruzado (Tester → Desenvolvedor)
      </p>

      {classIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Vincule esta missão a pelo menos uma turma para configurar os pareamentos.
        </p>
      ) : null}

      {rows.length ? (
        <ul className="space-y-1 text-sm">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span>
                <strong>{groupName(p.tester_group_id)}</strong> → {groupName(p.developer_group_id)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await remove.mutateAsync(p.id);
                    toast.success("Pareamento removido.");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum pareamento configurado neste bloco.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label className="text-xs">Equipe que testa</Label>
          <NativeSelect value={tester} onChange={setTester}>
            <option value="">Selecione...</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Equipe desenvolvedora</Label>
          <NativeSelect value={developer} onChange={setDeveloper}>
            <option value="">Selecione...</option>
            {devOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            disabled={!tester || !developer || save.isPending}
            onClick={async () => {
              if (tester === developer) {
                toast.error("A equipe testadora não pode ser a mesma equipe desenvolvedora.");
                return;
              }
              if (rows.some((p) => p.tester_group_id === tester)) {
                toast.error("Esta equipe já possui uma equipe desenvolvedora neste bloco.");
                return;
              }
              try {
                await save.mutateAsync({
                  sectionId,
                  testerGroupId: tester,
                  developerGroupId: developer,
                  classId: testerGroup?.class_id ?? "",
                });
                setTester("");
                setDeveloper("");
                toast.success("Pareamento adicionado.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            + Adicionar pareamento
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Os pareamentos valem apenas para esta missão e este bloco. O aluno não escolhe a equipe: ela é
        determinada automaticamente pelo pareamento.
      </p>
    </div>
  );
}
