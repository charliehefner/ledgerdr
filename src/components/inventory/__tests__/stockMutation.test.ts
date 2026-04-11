import { describe, it, expect } from "vitest";

interface StockItem {
  id: string;
  quantity: number;
}

function applyStockDeduction(item: StockItem, usedQty: number): StockItem {
  if (usedQty < 0) throw new Error("Usage quantity cannot be negative");
  if (usedQty > item.quantity) throw new Error("Insufficient stock");
  return { ...item, quantity: item.quantity - usedQty };
}

function reconcileEdit(
  currentQty: number,
  originalUsed: number,
  newUsed: number
): number {
  // Restore original, then apply new
  const restored = currentQty + originalUsed;
  const afterNew = restored - newUsed;
  if (afterNew < 0) throw new Error("Edit would result in negative stock");
  return afterNew;
}

describe("Inventory Stock Mutations", () => {
  it("deducts stock correctly", () => {
    const result = applyStockDeduction({ id: "item1", quantity: 100 }, 30);
    expect(result.quantity).toBe(70);
  });

  it("prevents over-deduction", () => {
    expect(() =>
      applyStockDeduction({ id: "item1", quantity: 10 }, 20)
    ).toThrow("Insufficient stock");
  });

  it("prevents negative usage", () => {
    expect(() =>
      applyStockDeduction({ id: "item1", quantity: 10 }, -5)
    ).toThrow("Usage quantity cannot be negative");
  });

  it("reconciles edit correctly (restore then deduct)", () => {
    // Stock is 70 after original deduction of 30 from 100
    const newQty = reconcileEdit(70, 30, 25);
    expect(newQty).toBe(75); // 70 + 30 - 25
  });

  it("reconciles edit prevents negative result", () => {
    expect(() => reconcileEdit(5, 10, 50)).toThrow("negative stock");
  });
});
