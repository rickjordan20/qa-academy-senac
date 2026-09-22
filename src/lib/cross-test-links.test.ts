import { describe, expect, it } from "vitest";
import { isCrossTestReference, readCrossTestReferences, writeCrossTestReferences } from "./cross-test-links";

const bug = { kind: "bug" as const, origin: "mission" as const, id: "123e4567-e89b-42d3-a456-426614174000" };
const qaBug = { ...bug, origin: "qa" as const };

describe("cross-test references", () => {
  it("accepts a typed mission record and rejects arbitrary strings", () => {
    expect(isCrossTestReference(bug)).toBe(true);
    expect(isCrossTestReference({ ...bug, id: "../../secret" })).toBe(false);
    expect(isCrossTestReference({ ...bug, kind: "unknown" })).toBe(false);
  });

  it("keeps mission and QA records with the same UUID distinct", () => {
    const data = writeCrossTestReferences({ titulo: "Grupo A", bugs: "Texto antigo" }, [bug, qaBug, bug]);
    expect(readCrossTestReferences(data)).toEqual([bug, qaBug]);
    expect(data.titulo).toBe("Grupo A");
    expect(data.bugs).toBe("Texto antigo");
  });

  it("does not fail when older entries have no links or malformed JSON", () => {
    expect(readCrossTestReferences({ titulo: "Grupo A" })).toEqual([]);
    expect(readCrossTestReferences({ linked_records_v1: "invalid" })).toEqual([]);
    expect(readCrossTestReferences({ linked_records_v1: JSON.stringify([bug, null, { id: "bad" }]) })).toEqual([bug]);
  });

  it("rejects invalid references rather than persisting them", () => {
    expect(() => writeCrossTestReferences({}, [{ ...bug, id: "bad" }])).toThrow("Referência inválida");
  });
});
