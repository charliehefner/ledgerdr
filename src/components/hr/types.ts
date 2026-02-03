export interface Jornalero {
  id: string;
  name: string;
  cedula: string;
  is_active: boolean;
}

export interface DayLaborEntry {
  id: string;
  work_date: string;
  week_ending_date: string;
  operation_description: string;
  worker_name: string;
  workers_count: number;
  field_name: string | null;
  amount: number;
  is_closed: boolean;
}

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
  entries: DayLaborEntry[];
  subtotal: number;
}
