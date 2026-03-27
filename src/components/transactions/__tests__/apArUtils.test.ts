import { describe, it, expect } from "vitest";
import {
  shouldCreateApAr,
  getApArAccountCode,
  getApArDirection,
  getDefaultDueDate,
  type ApArFormData,
} from "../apArUtils";

describe("shouldCreateApAr", () => {
  const base: ApArFormData = {
    transaction_direction: "purchase",
    pay_method: "cash",
    due_date: null,
    master_acct_code: "5100",
  };

  it("returns false for transfers", () => {
    expect(shouldCreateApAr({ ...base, pay_method: "credit" }, true)).toBe(false);
  });

  it("returns false for payments", () => {
    expect(shouldCreateApAr({ ...base, transaction_direction: "payment" }, false)).toBe(false);
  });

  it("returns false for investments", () => {
    expect(shouldCreateApAr({ ...base, transaction_direction: "investment" }, false)).toBe(false);
  });

  it("returns true when pay_method is credit", () => {
    expect(shouldCreateApAr({ ...base, pay_method: "credit" }, false)).toBe(true);
  });

  it("returns true when due_date is set", () => {
    expect(shouldCreateApAr({ ...base, due_date: "2025-12-31" }, false)).toBe(true);
  });

  it("returns true for advance accounts (1690)", () => {
    expect(shouldCreateApAr({ ...base, master_acct_code: "1690" }, false)).toBe(true);
  });

  it("returns false for cash purchase with no due_date", () => {
    expect(shouldCreateApAr(base, false)).toBe(false);
  });
});

describe("getApArAccountCode", () => {
  it("returns 1690 for advances", () => {
    expect(getApArAccountCode(true, "payable")).toBe("1690");
    expect(getApArAccountCode(true, "receivable")).toBe("1690");
  });

  it("returns 2101 for payables", () => {
    expect(getApArAccountCode(false, "payable")).toBe("2101");
  });

  it("returns 1210 for receivables", () => {
    expect(getApArAccountCode(false, "receivable")).toBe("1210");
  });
});

describe("getApArDirection", () => {
  it("returns payable for advances", () => {
    expect(getApArDirection({ transaction_direction: "sale", pay_method: "cash", due_date: null, master_acct_code: "1690" })).toBe("payable");
  });

  it("returns receivable for sales", () => {
    expect(getApArDirection({ transaction_direction: "sale", pay_method: "credit", due_date: null, master_acct_code: "5100" })).toBe("receivable");
  });

  it("returns payable for purchases", () => {
    expect(getApArDirection({ transaction_direction: "purchase", pay_method: "credit", due_date: null, master_acct_code: "5100" })).toBe("payable");
  });
});

describe("getDefaultDueDate", () => {
  it("adds 30 days to the given date", () => {
    expect(getDefaultDueDate("2025-01-01")).toBe("2025-01-31");
  });

  it("handles month rollover", () => {
    expect(getDefaultDueDate("2025-03-15")).toBe("2025-04-14");
  });

  it("handles year rollover", () => {
    expect(getDefaultDueDate("2025-12-10")).toBe("2026-01-09");
  });
});
