/**
 * Centralized type definitions shared across the application.
 * Move common interfaces here to avoid duplication.
 */

// =====================
// Equipment Types
// =====================

export interface TractorEquipment {
  id: string;
  name: string;
  equipment_type: string;
  current_hour_meter: number;
  is_active: boolean;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  hp: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
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
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  is_active?: boolean;
  purchase_date?: string | null;
  purchase_price?: number | null;
}

// =====================
// Farm & Field Types
// =====================

export interface Farm {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Field {
  id: string;
  name: string;
  hectares: number | null;
  farm_id: string;
  farms: { name: string };
  is_active?: boolean;
}

// =====================
// Operation Types
// =====================

export interface OperationType {
  id: string;
  name: string;
  is_mechanical: boolean;
  is_active?: boolean;
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

// =====================
// Inventory Types
// =====================

export interface InventoryItem {
  id: string;
  commercial_name: string;
  molecule_name: string | null;
  function: string;
  use_unit: string;
  current_quantity: number;
  purchase_unit_type: string;
  purchase_unit_quantity: number;
  price_per_purchase_unit: number;
  sack_weight_kg: number | null;
  co2_equivalent: number | null;
  supplier: string | null;
  is_active: boolean;
  cas_number: string | null;
  normal_dose_per_ha: number | null;
  minimum_stock: number | null;
}

export interface InventoryPurchase {
  id: string;
  item_id: string;
  quantity: number;
  packaging_quantity: number;
  packaging_unit: string;
  unit_price: number;
  total_price: number;
  purchase_date: string;
  supplier: string | null;
  document_number: string | null;
  notes: string | null;
}

// =====================
// HR Types
// =====================

export interface Employee {
  id: string;
  name: string;
  cedula: string;
  position: string;
  salary: number;
  date_of_hire: string;
  date_of_birth: string | null;
  is_active: boolean;
  bank: string | null;
  bank_account_number: string | null;
  shirt_size: string | null;
  pant_size: string | null;
  boot_size: string | null;
}

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

export interface ServiceProvider {
  id: string;
  name: string;
  cedula: string;
  bank: string | null;
  bank_account_type: string | null;
  currency: string | null;
  bank_account_number: string | null;
  is_active: boolean;
}

export interface ServiceEntry {
  id: string;
  provider_id: string;
  service_date: string;
  master_acct_code: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  comments: string | null;
  is_closed: boolean;
}

export interface PayrollPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
}

// =====================
// Fuel Types
// =====================

export interface FuelTank {
  id: string;
  name: string;
  fuel_type: string;
  capacity_gallons: number;
  current_level_gallons: number;
  use_type: string;
  is_active: boolean;
}

export interface FuelTransaction {
  id: string;
  tank_id: string;
  equipment_id: string | null;
  transaction_type: string;
  gallons: number;
  transaction_date: string;
  hour_meter_reading: number | null;
  previous_hour_meter: number | null;
  gallons_per_hour: number | null;
  pump_start_reading: number | null;
  pump_end_reading: number | null;
  notes: string | null;
}

// =====================
// Transaction Types
// =====================

export interface Transaction {
  id: string;
  transaction_date: string;
  master_acct_code: string | null;
  cbs_code: string | null;
  project_code: string | null;
  description: string;
  currency: string;
  amount: number;
  itbis: number | null;
  itbis_retenido: number | null;
  isr_retenido: number | null;
  pay_method: string | null;
  document: string | null;
  name: string | null;
  rnc: string | null;
  comments: string | null;
  is_void: boolean;
  void_reason: string | null;
  voided_at: string | null;
  legacy_id: number | null;
  cost_center: string;
  is_internal: boolean;
  transaction_direction: string | null;
  dgii_tipo_bienes_servicios: string | null;
  dgii_tipo_ingreso: string | null;
  dgii_tipo_anulacion: string | null;
}

// =====================
// Sorting Types
// =====================

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig<T extends string = string> {
  key: T | null;
  direction: SortDirection;
}

// =====================
// Export Types
// =====================

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  format?: (value: unknown) => string;
}
