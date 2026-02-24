

## Give AI Access to Full Inventory Data

Currently, the AI search intentionally excludes inventory prices, purchase history, and usage data. Since this is market information (not sensitive), we'll expand the data the AI receives.

### What Changes

**File: `supabase/functions/ai-search/index.ts`**

1. **Expand inventory query** to include `price_per_purchase_unit`, `purchase_unit_type`, `purchase_unit_quantity`, `supplier`, and `co2_equivalent`

2. **Add two new data queries**:
   - `inventory_purchases` -- recent purchase records with `supplier`, `quantity`, `unit_price`, `total_price`, `purchase_date`, `packaging_unit`, `packaging_quantity`
   - `operation_inputs` -- usage records joined with `inventory_items` (commercial_name, use_unit) and `operations` (operation_date, field/farm names)

3. **Update the AI system prompt**:
   - Remove the "sin precios" restriction from the inventory section
   - Add full item details: price per purchase unit, supplier, CO2 equivalent
   - Add a new "COMPRAS DE INVENTARIO" (Inventory Purchases) section showing recent purchases with prices, quantities, and suppliers
   - Add a new "USO DE INSUMOS" (Input Usage) section showing which inputs were used, how much, on which fields
   - Update the instructions to remove the line that says "precios de inventario no están disponibles"

### Technical Details

```text
New queries added:
  - inventory_purchases: last 200 records, joined with inventory_items for commercial_name
  - operation_inputs: last 200 records, joined with inventory_items and operations->fields->farms

Updated inventory line format:
  "- Glifosato (Glifosato 48%): 150 L, Función: herbicide, Precio: RD$450/unit, Proveedor: AgroQuímicos SRL"

New purchase line format:
  "- 2025-01-15: Glifosato x5 unidades a RD$450/u = RD$2,250 (Proveedor: AgroQuímicos)"

New usage line format:
  "- 2025-01-20: Glifosato 3.5 L en Campo Norte (Finca Solar) - Aplicación herbicida"
```

No database changes needed -- all tables already exist with appropriate RLS policies.

