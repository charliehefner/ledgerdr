

# Input Usage Report: Molecule Summary with Diesel Split (Ag/Industrial)

## What Changes

When viewing "All Inputs" and clicking "Resumen Moléculas", the molecule summary table currently only shows chemical inputs. This plan adds diesel to the molecule summary, split into "Diesel Agrícola" and "Diesel Industrial" based on the fuel tank's `use_type`.

The detail view will also label diesel rows as "Diesel Agrícola" or "Diesel Industrial" instead of the generic "Diesel".

## Implementation

### 1. Split diesel by tank use_type in `dieselUsageRows`

The fuel transaction query already fetches `fuel_tanks!inner(fuel_type)`. Expand this to also select `use_type`:

```
fuel_tanks!inner(fuel_type, use_type)
```

Then in the diesel row builder, use the tank's `use_type` to set `inputName`:
- `use_type === 'agriculture'` → `"Diesel Agrícola"`
- `use_type === 'industry'` → `"Diesel Industrial"`
- fallback → `"Diesel"`

This affects both the detail table rows and the data available for the molecule summary.

### 2. Include diesel in `moleculeSummary`

The current molecule summary only iterates over `operation_inputs` (chemicals). After that loop, also iterate over the already-computed `dieselUsageRows` and group them into the molecule map using their `inputName` as the molecule key (e.g., "Diesel Agrícola", "Diesel Industrial"). Unit is "gal", CO2-e defaults to 0 (or a configured value if available).

### 3. No database changes needed

The `fuel_tanks.use_type` column already exists and is populated. The query just needs to select it.

## Files Modified

- `src/components/operations/InputUsageReport.tsx` — expand fuel_tanks select, label diesel rows by use_type, include diesel in molecule summary computation

