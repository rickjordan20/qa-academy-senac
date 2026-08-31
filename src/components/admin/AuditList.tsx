import { ACTION_LABEL, ENTITY_LABEL, diffFields, useAuditLog } from "@/lib/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuditList({
  entity,
  entityId,
  title = "Histórico de alterações",
  limit = 30,
}: {
  entity?: string | undefined;
  entityId?: string | null | undefined;
  title?: string;
  limit?: number;
}) {
  const { data } = useAuditLog(entity, entityId ?? null, limit);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        )}
        {(data ?? []).map((row) => {
          const changes = diffFields(row.old_value, row.new_value).slice(0, 6);
          return (
            <div key={row.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {ENTITY_LABEL[row.entity] ?? row.entity} · {ACTION_LABEL[row.action] ?? row.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {changes.map((c) => (
                    <li key={c.key}>
                      <span className="text-foreground">{c.key}</span>: {c.from} → {c.to}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
