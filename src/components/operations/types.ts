export interface Field {
  id: string;
  name: string;
  hectares: number | null;
  farm_id: string;
  farms: { name: string };
}

export interface OperationType {
  id: string;
  name: string;
  is_mechanical: boolean;
}

export interface TractorEquipment {
  id: string;
  name: string;
  current_hour_meter: number;
  maintenance_interval_hours: number;
}

export interface MaintenanceRecord {
  tractor_id: string;
  hour_meter_reading: number;
}

export interface Implement {
  id: string;
  name: string;
  implement_type: string;
}

export interface InventoryItem {
  id: string;
  commercial_name: string;
  use_unit: string;
  current_quantity: number;
  function: string;
}

export interface OperationInput {
  inventory_item_id: string;
  quantity_used: number;
}

export interface Operation {
  id: string;
  operation_date: string;
  field_id: string;
  operation_type_id: string;
  tractor_id: string | null;
  implement_id: string | null;
  workers_count: number | null;
  hectares_done: number;
  start_hours: number | null;
  end_hours: number | null;
  notes: string | null;
  driver: string | null;
  fields: { name: string; farms: { name: string }; farm_id: string };
  operation_types: { name: string; is_mechanical: boolean };
  fuel_equipment: { name: string } | null;
  implements: { name: string } | null;
  operation_inputs: { 
    id: string;
    inventory_item_id: string;
    quantity_used: number; 
    inventory_items: { commercial_name: string; use_unit: string } 
  }[];
}

export type SortDirection = "asc" | "desc" | null;
export type SortColumn = "date" | "field" | "farm" | "operation" | "tractor" | "driver" | "implement" | "hours" | "hectares" | null;
