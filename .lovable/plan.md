

# Fix Monto Facturado: Use Subtotal Instead of Total

## Problem
The `amount` field in the transactions table stores the **total paid** (subtotal + ITBIS). The DGII reports require "Monto Facturado" to be the **subtotal** (amount before tax). Currently, all three reports display the raw `amount`, which overstates the figure by the ITBIS amount.

## Fix
Apply `amount - (itbis || 0)` wherever "Monto Facturado" is calculated.

## Files to Change

### 1. `src/components/accounting/DGII606Table.tsx` (line ~37)
Change the `montoFacturado` mapping from:
```
montoFacturado: tx.amount?.toFixed(2) || "0.00"
```
to:
```
montoFacturado: ((tx.amount || 0) - (tx.itbis || 0)).toFixed(2)
```

### 2. `src/components/accounting/DGII607Table.tsx` (line ~36)
Same change — `montoFacturado` mapping from:
```
montoFacturado: tx.amount?.toFixed(2) || "0.00"
```
to:
```
montoFacturado: ((tx.amount || 0) - (tx.itbis || 0)).toFixed(2)
```

### 3. `src/components/accounting/IT1ReportView.tsx` (lines 22-24 and 28-30)
Change both `totalVentasGravadas` and `totalComprasConItbis` calculations from:
```
.reduce((sum, s) => sum + Number(s.amount || 0), 0)
```
to:
```
.reduce((sum, s) => sum + (Number(s.amount || 0) - Number(s.itbis || 0)), 0)
```

## Summary
Three files, four lines changed. No database or schema changes needed.

