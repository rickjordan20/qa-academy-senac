import { Button } from "@/components/ui/button";

export function ClassPicker({
  classes,
  value,
  onChange,
}: {
  classes: { id: string; name: string }[] | undefined;
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {(classes ?? []).map((c) => (
        <Button
          key={c.id}
          size="sm"
          variant={value === c.id ? "default" : "outline"}
          onClick={() => onChange(c.id)}
        >
          {c.name}
        </Button>
      ))}
      {(classes ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada.</p>
      )}
    </div>
  );
}
