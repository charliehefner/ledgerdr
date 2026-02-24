

## Remove "Finca" Column and Add "Costo/Unidad" Column to Input Usage Report

### What Changes

The Input Usage Report table will:
1. **Remove** the "Finca" column from the table, exports (Excel and PDF), and totals row
2. **Add** a "Costo/Unidad" (cost per unit) column showing the price per use unit (liter, kg, gallon, etc.)

### Where Cost Data Comes From

The `inventory_items` table already stores `price_per_purchase_unit` and `purchase_unit_quantity`. The cost per use unit is calculated as:

```
cost_per_unit = price_per_purchase_unit / purchase_unit_quantity
```

For example, if a 20L drum costs RD$5,000, the cost per liter = 5000/20 = RD$250/L.

### Technical Details

**File:** `src/components/operations/InputUsageReport.tsx`

1. **Update the query** (line ~145): Add `price_per_purchase_unit` and `purchase_unit_quantity` to the `inventory_items` select within `operation_inputs`

2. **Update `OperationWithInput` interface** (line ~38): Add the two price fields to `inventory_items`

3. **Update `UsageRow` interface** (line ~65): Remove `farmName`, add `costPerUnit: number`

4. **Update `usageData` memo** (line ~167): Calculate `costPerUnit = price_per_purchase_unit / purchase_unit_quantity` per row instead of `farmName`

5. **Update totals memo** (line ~222): Add `totalCost` summing `costPerUnit * amount` for all rows

6. **Remove "Finca" column from table** (lines 568, 581): Remove the `<TableHead>Finca</TableHead>` and corresponding `<TableCell>{row.farmName}</TableCell>`

7. **Add "Costo/Unidad" column to table**: New `<TableHead>` and `<TableCell>` showing formatted cost per unit

8. **Update totals row colspan** (line 591): Adjust colspan since one column was removed and one added (net zero change)

9. **Update Excel export** (line ~282): Remove "Finca" from headers array, add "Costo/Unidad"; update data rows accordingly

10. **Update PDF export** (line ~354): Same changes for the PDF head/body arrays

