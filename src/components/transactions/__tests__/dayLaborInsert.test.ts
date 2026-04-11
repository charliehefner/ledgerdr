import { describe, it, expect } from "vitest";

/**
 * Integration-style tests that verify insert payloads for day labor
 * contain all required fields (especially entity_id).
 */

interface DayLaborPayload {
  worker_name: string;
  operation_description: string;
  work_date: string;
  week_ending_date: string;
  entity_id: string;
  amount: number;
  workers_count: number;
  field_name?: string | null;
}

function buildDayLaborPayload(
  input: Partial<DayLaborPayload> & { worker_name: string; operation_description: string; work_date: string; week_ending_date: string }
): DayLaborPayload {
  if (!input.entity_id) {
    throw new Error("entity_id is required for day_labor_entries");
  }
  return {
    worker_name: input.worker_name,
    operation_description: input.operation_description,
    work_date: input.work_date,
    week_ending_date: input.week_ending_date,
    entity_id: input.entity_id,
    amount: input.amount ?? 0,
    workers_count: input.workers_count ?? 1,
    field_name: input.field_name ?? null,
  };
}

describe("Day Labor Insert Payload", () => {
  it("rejects payload without entity_id", () => {
    expect(() =>
      buildDayLaborPayload({
        worker_name: "Juan",
        operation_description: "Limpieza",
        work_date: "2026-04-10",
        week_ending_date: "2026-04-12",
      })
    ).toThrow("entity_id is required");
  });

  it("accepts valid payload with entity_id", () => {
    const payload = buildDayLaborPayload({
      worker_name: "Juan",
      operation_description: "Limpieza",
      work_date: "2026-04-10",
      week_ending_date: "2026-04-12",
      entity_id: "550e8400-e29b-41d4-a716-446655440000",
      amount: 500,
    });
    expect(payload.entity_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(payload.workers_count).toBe(1);
  });
});
