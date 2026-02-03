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
}

export interface PurchaseAggregation {
  totalPurchased: number;
  suppliers: Set<string>;
  documents: Set<string>;
}

export interface StockAdjustmentItem {
  id: string;
  commercial_name: string;
  current_quantity: number;
  use_unit: string;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}
