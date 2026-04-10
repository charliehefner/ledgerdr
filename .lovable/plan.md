

# Add Equipment, Industrial & Extended Data to AI Search

## What's Changing
Expand the AI search edge function to include data from all major operational modules that are currently missing.

## Currently Available
Farms, fields, operation types, operations, employees, rainfall, day labor, inventory (items + purchases + usage), fuel transactions, fuel tanks.

## Data to Add

1. **Fuel Equipment (Tractors/Vehicles)** — `fuel_equipment` table: name, equipment_type, current_hour_meter, maintenance_interval_hours, is_active
2. **Implements** — `implements` table: name, implement_type, working_width_m, is_active
3. **Fixed Assets** — `fixed_assets` table: name, category, acquisition_date, acquisition_cost, accumulated_depreciation, useful_life_years, is_active, disposal_date
4. **Industrial Carretas** — `industrial_carretas` table: identifier, datetime_out, datetime_in, tare, payload, weigh_ticket_number, notes
5. **Industrial Plant Hours** — `industrial_plant_hours` table: date, start_hour_meter, finish_hour_meter, notes
6. **Industrial Trucks** — `industrial_trucks` table: identifier, datetime_in, datetime_out, tare, payload, destination_payload, weigh_ticket_number, notes
7. **Contracted Services** — `service_contracts` + `contract_entries` tables: contract name, owner, operation type, price per unit, daily entries with quantities

## Implementation

### Single file change: `supabase/functions/ai-search/index.ts`

- Add 7 new queries to the existing `Promise.all` block
- Add corresponding sections to the system prompt with formatted data
- Limit industrial tables to last 200 records each, fixed assets to active ones, equipment/implements to active ones
- Redeploy the edge function

### System prompt additions
New sections: EQUIPOS (tractors/vehicles with hour meters), IMPLEMENTOS (implements with working widths), ACTIVOS FIJOS (fixed assets with depreciation info), CARRETAS INDUSTRIALES, HORAS DE PLANTA, CAMIONES INDUSTRIALES, SERVICIOS CONTRATADOS.

