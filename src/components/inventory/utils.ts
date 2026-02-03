import { InventoryItem, PurchaseAggregation, SortConfig } from "./types";

/**
 * Format stock display with unit
 */
export function formatStock(item: InventoryItem): string {
  const qty = Number(item.current_quantity);
  return `${qty.toFixed(2)} ${item.use_unit}`;
}

/**
 * Aggregate purchase data by item ID
 */
export function aggregatePurchases(
  purchases: Array<{
    item_id: string;
    quantity: number;
    packaging_quantity: number;
    supplier: string | null;
    document_number: string | null;
  }> | undefined
): Record<string, PurchaseAggregation> {
  if (!purchases) return {};

  return purchases.reduce((acc, purchase) => {
    const itemId = purchase.item_id;
    if (!acc[itemId]) {
      acc[itemId] = {
        totalPurchased: 0,
        suppliers: new Set<string>(),
        documents: new Set<string>(),
      };
    }

    // Calculate total in use units (quantity × packaging_quantity)
    const packagingQty = Number(purchase.packaging_quantity) || 1;
    acc[itemId].totalPurchased += Number(purchase.quantity) * packagingQty;

    if (purchase.supplier) {
      acc[itemId].suppliers.add(purchase.supplier);
    }
    if (purchase.document_number) {
      acc[itemId].documents.add(purchase.document_number);
    }

    return acc;
  }, {} as Record<string, PurchaseAggregation>);
}

/**
 * Aggregate usage by item from operation inputs and fuel transactions
 */
export function aggregateUsage(
  operationInputs: Array<{
    inventory_item_id: string;
    quantity_used: number;
  }> | undefined,
  fuelTransactions: Array<{
    gallons: number;
    fuel_tanks: { fuel_type: string } | null;
  }> | undefined,
  items: InventoryItem[] | undefined
): Record<string, number> {
  const usage: Record<string, number> = {};

  // Add usage from operation_inputs
  if (operationInputs) {
    operationInputs.forEach((input) => {
      const itemId = input.inventory_item_id;
      usage[itemId] = (usage[itemId] || 0) + Number(input.quantity_used);
    });
  }

  // Add fuel dispensing usage - match by fuel type to inventory items
  if (fuelTransactions && items) {
    const fuelItems = items.filter((item) => item.function === "fuel");

    fuelTransactions.forEach((tx) => {
      const fuelType = tx.fuel_tanks?.fuel_type?.toLowerCase() || "";
      const matchingItem = fuelItems.find(
        (item) =>
          item.commercial_name.toLowerCase().includes(fuelType) ||
          fuelType.includes(item.commercial_name.toLowerCase())
      );

      if (matchingItem) {
        usage[matchingItem.id] = (usage[matchingItem.id] || 0) + Number(tx.gallons);
      }
    });
  }

  return usage;
}

/**
 * Sort inventory items by given configuration
 */
export function sortInventoryItems(
  items: InventoryItem[] | undefined,
  sortConfig: SortConfig,
  purchasesByItem: Record<string, PurchaseAggregation>,
  usageByItem: Record<string, number>
): InventoryItem[] {
  if (!items || !sortConfig.key || !sortConfig.direction) return items || [];

  return [...items].sort((a, b) => {
    const key = sortConfig.key;
    let aVal: string | number | null = null;
    let bVal: string | number | null = null;

    switch (key) {
      case "commercial_name":
      case "molecule_name":
      case "function":
        aVal = (a[key as keyof InventoryItem] as string) || "";
        bVal = (b[key as keyof InventoryItem] as string) || "";
        break;
      case "stock":
        aVal = Number(a.current_quantity);
        bVal = Number(b.current_quantity);
        break;
      case "amount_purchased":
        aVal = purchasesByItem[a.id]?.totalPurchased || 0;
        bVal = purchasesByItem[b.id]?.totalPurchased || 0;
        break;
      case "amount_used":
        aVal = usageByItem[a.id] || 0;
        bVal = usageByItem[b.id] || 0;
        break;
      case "co2_equivalent":
        aVal = a.co2_equivalent || 0;
        bVal = b.co2_equivalent || 0;
        break;
      case "suppliers":
        aVal = purchasesByItem[a.id]?.suppliers?.size || 0;
        bVal = purchasesByItem[b.id]?.suppliers?.size || 0;
        break;
      case "documents":
        aVal = purchasesByItem[a.id]?.documents?.size || 0;
        bVal = purchasesByItem[b.id]?.documents?.size || 0;
        break;
      default:
        return 0;
    }

    // Handle nulls
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // Handle numbers
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Handle strings
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return sortConfig.direction === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });
}
