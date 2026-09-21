import type { MissionEntry } from "@/lib/mission-builder";

/** References are stored inside the existing cross_test entry data JSON.
 * Legacy free-text fields remain untouched for previously submitted missions.
 * A reference is never a copy of a bug, case, evidence or retest.
 */
export type CrossTestReferenceKind = "case" | "bug" | "evidence" | "retest";
export type CrossTestReferenceOrigin = "qa" | "mission";
export type CrossTestReference = {
  kind: CrossTestReferenceKind;
  origin: CrossTestReferenceOrigin;
  id: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS: readonly string[] = ["case", "bug", "evidence", "retest"];
const ORIGINS: readonly string[] = ["qa", "mission"];
const KEY = "linked_records_v1";

export function isCrossTestReference(value: unknown): value is CrossTestReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.kind === "string" && KINDS.includes(record.kind)
    && typeof record.origin === "string" && ORIGINS.includes(record.origin)
    && typeof record.id === "string" && UUID.test(record.id);
}

/** Malformed historical JSON is ignored, not silently overwritten or executed. */
export function readCrossTestReferences(data: MissionEntry["data"]): CrossTestReference[] {
  const raw = data[KEY];
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    return parsed.filter((item): item is CrossTestReference => {
      if (!isCrossTestReference(item)) return false;
      const key = `${item.kind}:${item.origin}:${item.id.toLowerCase()}`;
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

/** Only the reference key changes; legacy descriptions, results and group labels survive. */
export function writeCrossTestReferences(
  data: MissionEntry["data"],
  references: readonly CrossTestReference[],
): MissionEntry["data"] {
  if (!references.every(isCrossTestReference)) throw new Error("Referência inválida no teste cruzado.");
  const deduplicated = readCrossTestReferences({ [KEY]: JSON.stringify(references) });
  return { ...data, [KEY]: JSON.stringify(deduplicated) };
}

export function crossTestReferenceKey(reference: CrossTestReference): string {
  return `${reference.kind}:${reference.origin}:${reference.id.toLowerCase()}`;
}
