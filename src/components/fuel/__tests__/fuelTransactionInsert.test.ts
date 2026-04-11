import { describe, it, expect } from "vitest";

interface FuelTransactionPayload {
  tractor_id: string;
  tank_id: string;
  entity_id: string;
  gallons: number;
  pump_start: number;
  pump_end: number;
  hour_meter: number;
  operator_name: string;
  dispensed_at: string;
}

function validateFuelPayload(input: Partial<FuelTransactionPayload>): string[] {
  const errors: string[] = [];
  if (!input.entity_id) errors.push("entity_id is required");
  if (!input.tractor_id) errors.push("tractor_id is required");
  if (!input.tank_id) errors.push("tank_id is required");
  if (input.pump_end !== undefined && input.pump_start !== undefined) {
    if (input.pump_end <= input.pump_start) {
      errors.push("pump_end must be greater than pump_start");
    }
    const gallons = input.pump_end - input.pump_start;
    if (input.gallons !== undefined && Math.abs(gallons - input.gallons) > 0.01) {
      errors.push("gallons must equal pump_end - pump_start");
    }
  }
  if (input.hour_meter !== undefined && input.hour_meter < 0) {
    errors.push("hour_meter must be non-negative");
  }
  return errors;
}

describe("Fuel Transaction Validation", () => {
  it("catches missing entity_id", () => {
    const errors = validateFuelPayload({
      tractor_id: "t1",
      tank_id: "tk1",
      pump_start: 100,
      pump_end: 120,
      gallons: 20,
      hour_meter: 500,
    });
    expect(errors).toContain("entity_id is required");
  });

  it("catches missing tank_id", () => {
    const errors = validateFuelPayload({
      entity_id: "e1",
      tractor_id: "t1",
    });
    expect(errors).toContain("tank_id is required");
  });

  it("catches pump_end <= pump_start", () => {
    const errors = validateFuelPayload({
      entity_id: "e1",
      tractor_id: "t1",
      tank_id: "tk1",
      pump_start: 120,
      pump_end: 100,
      gallons: -20,
      hour_meter: 500,
    });
    expect(errors).toContain("pump_end must be greater than pump_start");
  });

  it("accepts valid payload", () => {
    const errors = validateFuelPayload({
      entity_id: "e1",
      tractor_id: "t1",
      tank_id: "tk1",
      pump_start: 100,
      pump_end: 120,
      gallons: 20,
      hour_meter: 500,
      operator_name: "Pedro",
      dispensed_at: "2026-04-10T10:00:00Z",
    });
    expect(errors).toHaveLength(0);
  });
});
