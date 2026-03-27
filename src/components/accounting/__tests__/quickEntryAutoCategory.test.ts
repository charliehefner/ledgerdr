import { describe, it, expect } from "vitest";
import { matchAutoCategory } from "../QuickEntryDialog";

describe("matchAutoCategory", () => {
  it("matches COMISIÓN → 6520", () => {
    expect(matchAutoCategory("COMISIÓN bancaria")).toBe("6520");
  });

  it("matches COMISION (no accent) → 6520", () => {
    expect(matchAutoCategory("COMISION de manejo")).toBe("6520");
  });

  it("matches IMPUESTO LEY → 6530", () => {
    expect(matchAutoCategory("IMPUESTO LEY 123-45")).toBe("6530");
  });

  it("matches ITBIS → 1650", () => {
    expect(matchAutoCategory("ITBIS retenido")).toBe("1650");
  });

  it("matches INTERÉS → 6510", () => {
    expect(matchAutoCategory("INTERÉS mensual")).toBe("6510");
  });

  it("matches INTERES (no accent) → 6510", () => {
    expect(matchAutoCategory("INTERES corriente")).toBe("6510");
  });

  it("returns null for unmatched description", () => {
    expect(matchAutoCategory("Pago proveedor ABC")).toBeNull();
  });

  it("returns null for null description", () => {
    expect(matchAutoCategory(null)).toBeNull();
  });
});
