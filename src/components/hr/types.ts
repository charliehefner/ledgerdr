// Re-export shared types from centralized location
export type { Jornalero, DayLaborEntry } from "@/types/index";

// HR-specific types (not shared elsewhere)
export interface NewDayLaborEntry {
  work_date: string;
  operation_description: string;
  worker_name: string;
  workers_count: string;
  field_name: string;
  amount: string;
}

export interface WorkerSummary {
  name: string;
  entries: import("@/types/index").DayLaborEntry[];
  subtotal: number;
}
