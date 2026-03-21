# Chapter 5: Operations

This chapter covers all modules that support day-to-day field and equipment management: recording field operations, managing fuel and equipment, tracking inventory of agrochemicals, logging day labor, scheduling workers, and maintaining service contracts. Read this chapter if you are a Supervisor, Farm Manager, or Accountant responsible for operational data entry.

> **Who can access Operations?**
> Supervisors have full access to Operations, Fuel, Maintenance, Cronograma, and Rainfall modules. Accountants share full operational access and can additionally create transactions linked to operations. Management and Admin roles have full access to all modules. Viewers can read all operational data but cannot create or edit records.

---

## 5.1 Operations Module Map

The Operations section of Ledger DR is accessible from the left-hand navigation menu. It contains the following sub-modules:

| Sub-module | Purpose |
|---|---|
| Field Operations | Log tractor and manual operations by field, date, implement, and driver |
| Fuel | Record fuel dispenses and tank refills; monitor equipment fuel consumption |
| Equipment Maintenance | Track oil-change and routine maintenance events by hour meter |
| Inventory | Manage agrochemical and input stock; record purchases and usage |
| Day Labor | Log and close weekly jornalero (day worker) entries by field and task |
| Cronograma | Weekly work schedule for permanent employees and day workers |
| Service Contracts | Track third-party equipment contracts by work unit and payment |
| Rainfall | Record daily rainfall readings across the four farm weather stations |

---

## 5.2 Farms and Fields

All operations are assigned to a specific field. Fields belong to farms. Understanding the farm-field hierarchy is essential before recording any operation.

### 5.2.1 Farm List

The system currently manages eight farms:

- La Java
- Madrigal
- Palmarito
- Bebe
- La Virgencita
- Solar
- Caoba
- Carriles

Farms are managed by administrators. If a farm is missing, contact your system administrator — do not create duplicate entries.

### 5.2.2 Fields

There are 84 fields registered across all farms. Each field has a short code (e.g., C02, BN5, AP01) and a size in hectares. When recording an operation, you select the field from a dropdown. Inactive fields do not appear in the dropdown.

> **Field codes**
> Field codes are short alphanumeric identifiers assigned when a field is created. If you cannot find a field in the dropdown, it may be deactivated. Ask your administrator to reactivate it, or verify you have selected the correct farm filter first.

---

## 5.3 Recording Field Operations

A field operation is any mechanical or manual agricultural activity performed on a specific field on a specific date — harrowing, planting, spraying, harvesting, and so on. Operations are the core productivity record of the system.

Navigate to **Operations > Field Operations** and click **+ New Operation**.

### 5.3.1 Operation Types

The system has 41 active operation types, divided into mechanical (requires a tractor) and manual (no tractor). The type selected determines which other fields are relevant.

**Mechanical operations** (tractor required): Cultivador, Distribuir semilla, Tapar mecánico, Mulcher, Canterizador, Rastra, Rastra 2, Rastra 3, Chapear, Cosecha, Pala, Mantenimiento, Pulverizar, Autovolteo, Drenar, Resiembra (mecánica), Siembra, Transporte de semilla, Transporte de fertilizante, Transporte de agua para agroquímicos, Aporque, Transporte de Equipos, Transporte de Piedra, Picador Industria, Transporte de personal.

**Manual operations** (no tractor): Remover Pajón, Recoger piedra, Siembra manual, Tapar manual, Deshierbo manual, Recoger palos/raíces, Sacado de pajón, Chapeo manual, Chapeo Trimmer, Drenar Agua, Corte de semilla, Resiembra, Retapado, Fertilización, Pulverizar (manual), Empalizada.

> **Mechanical vs. manual operations**
> Mechanical operations require you to select a Tractor and may require an Implement. The Tractor field is optional in the form but strongly recommended — without it, hour meter tracking and fuel reconciliation are impossible. Manual operations do not require a tractor; enter Workers Count instead.

### 5.3.2 Operation Form Fields

| Field | Required? | Description |
|---|---|---|
| Operation Date | Required | The date the work was performed. Defaults to today. Cannot be a future date. |
| Operation Type | Required | Select from 41 active types. Determines whether tractor and implement fields are shown. |
| Field | Required | The specific farm field where the operation took place. |
| Tractor | Recommended | Required for all mechanical operations. Select from the 10 registered tractors. Leaving this blank disables hour meter tracking and fuel efficiency reporting. |
| Implement | Optional | The implement attached to the tractor. Not required for transport or simple operations. |
| Driver | Recommended | Name of the tractor operator. Free text. Used in productivity reports and equipment accountability. |
| Start Hours | Recommended | Hour meter reading at the start of the operation. Required for fuel-per-hour calculations. |
| End Hours | Recommended | Hour meter reading at the end. Must be ≥ Start Hours. |
| Hectares Done | Recommended | Area covered in hectares. Used to calculate cost-per-hectare and application rates. Defaults to 0. |
| Workers Count | Conditional | Number of manual workers involved. Required for manual operations. |
| Notes | Optional | Free-text notes about conditions, issues, or observations. |

> ⚠️ **Always enter hectares done**
> Hectares Done is the most important productivity metric. Currently 82% of operations in the system have this field left at zero, making cost-per-hectare reports unreliable. Please enter the actual area completed for every operation, even an estimate.

### 5.3.3 Tractor and Equipment Reference

| Name | Type / Brand | Current Hours |
|---|---|---|
| Pala Volvo | Volvo L70H (loader) | 541 h |
| Shaktiman | Shaktiman 3636 Tejas | 51 h |
| Landini 90S | Landini 90S | 2,027 h |
| JD3006 | John Deere 6150R | 7,141 h |
| JD2326 | John Deere 6150R | 7,190 h |
| JD 7280R | John Deere 7280R | 5,074 h |
| MF4297 | Massey Ferguson 4297 | 4,660 h |
| JD 7230R | John Deere 7230R | 5,522 h |
| Drone | Drone (aerial sprayer) | 0 h |
| Contrato | Third-party contract equipment | 2,588 h |

Available implements include: Cultivadora (Baldan), Rastra Tatú, Rastra Maschio, Mulcher (FAE), Cosechadora (Colhicana), Canterizador (Agromatão), Chapeadora, Pulverizador, Tapador, Sanjeador, Autovolteo, Cobra (Elho), Trimmer (Stihl), and Carreta de cana.

### 5.3.4 Attaching Inventory Inputs

If the operation involved applying agrochemicals, fertilizers, or other inventory items, you can attach the inputs consumed directly to the operation record.

1. Save the operation first.
2. Open the saved operation and scroll to the **Inputs** section at the bottom of the detail view.
3. Click **+ Add Input**.
4. Select the inventory item from the dropdown (only active items are shown).
5. Enter the quantity used in the item's base unit (liters, kg, or gallons as appropriate).
6. Click **Save Input**. Repeat for each product applied.

> **Inputs and stock**
> Every input you attach records the quantity used against that inventory item. This is the primary mechanism for tracking agrochemical consumption per field and operation. See Section 5.6 for Inventory management.

### 5.3.5 Editing and Deleting Operations

Operations can be edited by Supervisors, Accountants, and Management at any time. Use the edit icon from the operations list or from the operation detail view.

> ⚠️ **Deleting an operation also deletes its inputs**
> If you delete an operation that has attached inputs, all input records for that operation are permanently removed. This will affect inventory consumption reports. Prefer editing over deletion whenever possible.

---

## 5.4 Fuel Management

The Fuel module tracks diesel consumption across the farm's three tanks and ten pieces of equipment. There are two transaction types: **refills** (diesel added to a tank) and **dispenses** (diesel dispensed from a tank to equipment).

### 5.4.1 Fuel Tanks

| Tank Name | Use Type | Capacity | Current Level |
|---|---|---|---|
| Mobile | Agriculture | 560 gal | 462 gal |
| Main Tank | Agriculture | 1,200 gal | 0 gal |
| Planta Tank | Industry | 1,000 gal | 110 gal |

> ⚠️ **Tank levels shown may not be current**
> A known system limitation: fuel dispense transactions currently update the pump counter but may not automatically deduct gallons from the displayed tank level. Always verify the physical tank gauge when planning fuel purchases. A fix for automated tank-level deduction is scheduled.

### 5.4.2 Recording a Fuel Dispense

A dispense is recorded when diesel is pumped from a tank to a piece of equipment. Navigate to **Operations > Fuel > + New Fuel Transaction** and select **Dispense**.

| Field | Required? | Description |
|---|---|---|
| Tank | Required | Which tank the fuel is drawn from. |
| Equipment | Required | The tractor or equipment receiving the fuel. |
| Date & Time | Required | Defaults to now. |
| Gallons | Required | Gallons dispensed. Must be greater than zero. |
| Pump Start Reading | Required | Pump odometer reading before dispensing begins. |
| Pump End Reading | Required | Pump odometer reading after dispensing ends. The difference must match the Gallons field. |
| Hour Meter Reading | Recommended | Equipment's current hour meter at time of fueling. Used to compute gallons-per-hour efficiency. |
| Notes | Optional | Any relevant observation. |

> **Driver portal submissions**
> Drivers with the Driver role can submit fuel dispenses directly from a mobile-friendly portal. These submissions appear in **Operations > Fuel > Pending Submissions** for review before being committed to the ledger.

### 5.4.3 Recording a Tank Refill

Navigate to **Operations > Fuel > + New Fuel Transaction** and select **Refill**.

| Field | Required? | Description |
|---|---|---|
| Tank | Required | The tank being refilled. |
| Date | Required | The delivery date. |
| Gallons | Required | Gallons delivered. |
| Notes | Recommended | Record the supplier name and delivery reference number. |

> **Refill and the accounting module**
> Large fuel purchases should also be recorded as a transaction in **Accounting > Transactions** (see Chapter 4) to capture the financial cost. The fuel refill records the physical volume only.

### 5.4.4 Reviewing Fuel Consumption

The fuel list view shows all dispenses and refills in reverse chronological order. Filter by tank, equipment, or date range. Each dispense shows the calculated gallons-per-hour efficiency where an hour meter reading was provided.

> **Spotting excessive consumption**
> A significant spike in gallons-per-hour for a specific tractor may indicate a mechanical problem or a data entry error. Review any reading that differs by more than 30% from the same equipment's historical average.

---

## 5.5 Equipment Maintenance

The Maintenance sub-module tracks routine service events for each piece of equipment. Each tractor has a maintenance interval (default 250 hours) that triggers a warning when the current hour meter approaches the next service threshold.

### 5.5.1 Maintenance Countdown

The equipment list shows each tractor's hours remaining until the next scheduled service, calculated as:

> *Hours until maintenance = Maintenance interval − (Current hour meter − Last maintenance hour meter reading)*

When a tractor reaches 0 hours remaining, the system displays a maintenance warning badge on the equipment card and in the operations form when that tractor is selected.

### 5.5.2 Logging a Maintenance Event

Navigate to **Operations > Equipment > select the tractor > Maintenance tab > + Log Maintenance**.

| Field | Required? | Description |
|---|---|---|
| Maintenance Date | Required | The date the service was performed. Defaults to today. |
| Maintenance Type | Required | Currently: Routine only. Additional types may be added by administrators. |
| Hour Meter Reading | Required | The tractor's hour meter at the time of service. This resets the maintenance countdown. |
| Notes | Recommended | Record work done: oil grade, filter part numbers, technician name, observed issues. |

> ⚠️ **Hour meter corrections**
> The system only accepts hour meter readings equal to or greater than the last recorded reading. If a maintenance entry was made with an incorrect (too-high) value, the maintenance countdown will be reset to the wrong baseline. Contact your administrator to correct this — it cannot be fixed by creating a new maintenance record.

---

## 5.6 Inventory

The Inventory module manages stock levels for all agrochemicals, fertilizers, and other farm inputs. The current inventory contains 27 active items.

### 5.6.1 Viewing Stock Levels

Navigate to **Operations > Inventory** to see all active items with their current quantity, purchase unit, use unit, and recommended dose per hectare where configured.

> ⚠️ **Minimum stock alerts are not yet configured**
> None of the 27 inventory items currently have a minimum stock threshold set, so no low-stock alerts will fire. Supervisors should review stock levels manually before planning spray or fertilization operations.

### 5.6.2 Recording a Purchase

Navigate to **Operations > Inventory > select the item > + New Purchase**.

| Field | Required? | Description |
|---|---|---|
| Purchase Date | Required | The date the goods were received. |
| Quantity | Required | The quantity received in the item's purchase unit (liters, kg, gallons). |
| Unit Price | Required | Price per purchase unit in DOP. |
| Total Price | Required | Auto-calculated as Quantity × Unit Price. You may override if the invoice total differs. |
| Packaging Unit | Recommended | The packaging format (e.g., liter, gallon, sack, drum). |
| Packaging Quantity | Recommended | Units per package. Used to convert between purchase units and storage units. |
| Supplier | Recommended | Name of the supplier or distributor. |
| Document Number | Recommended | Invoice or purchase order number. Always record this for audit purposes. |
| Notes | Optional | Delivery condition, lot number, or expiration date. |

> **Link purchases to accounting**
> For purchases above RD$5,000, also create a corresponding transaction in **Accounting > Transactions** (see Chapter 4). The inventory purchase records the physical stock entry; the accounting transaction records the financial expenditure. The two records are not automatically linked — you must create both.

### 5.6.3 Inventory Items Reference

**Post-emergent herbicides**
Agromina 72 SL, Ametrex 50 SC, Cañarex 65 WG, Terbutrizell, Glifosato, Crezendo 45.5 CS, Rainbomina, Revolver, Profitol 75 WG, Picloran, MSMA, Dinamic (powder), Dinamix (powder)

**Pre-emergent herbicides**
Pledge 51 WG (kg), Enfoke 75 WG (gram), Karmex, Mayoral 35 SL

**Fertilizers**
DAP (kg), Cover Fertilizer (kg), Nutrihojas (liter)

**Adjuvants and conditioners**
Bivert (adherente), Bionex (adherente), Abland (condicionador), pH Ned (condicionador)

**Fuel (managed automatically from tank levels)**
Diesel Agrícola (gallons), Diesel Industrial (gallons)

> **Duplicate item: Dinamic**
> There are currently two items named "Dinamic" in the system (both post-emergent herbicides, both in kg). Before recording usage of Dinamic, verify which item your operation should reference. Ask your administrator to merge or rename the duplicate.

---

## 5.7 Day Labor (Jornaleros)

The Day Labor module tracks work performed by temporary day workers (jornaleros) paid by the day or task. Entries are grouped by week and can be closed once verified and paid.

### 5.7.1 Recording a Day Labor Entry

Navigate to **Operations > Day Labor > + New Entry**.

| Field | Required? | Description |
|---|---|---|
| Work Date | Required | The actual date the work was performed. |
| Week Ending Date | Required | The Saturday that ends the work week this entry belongs to. Used for weekly reporting and payment grouping. |
| Operation Description | Required | A brief description of the task (e.g., Chapeo manual, Siembra manual). Free text — does not link to formal operation types. |
| Field Name | Recommended | The field where the work was done. Enter the field code (e.g., Java 2, BN5) for consistency. |
| Worker Name | Recommended | Name of the day worker. Leave blank only if recording a group total. |
| Workers Count | Required | Number of workers for this entry. Defaults to 1. |
| Amount | Required | Total payment for this entry in DOP. For a group, this is the combined total. |

### 5.7.2 Closing a Week

Once all day labor entries for a week have been verified and paid, mark the week as closed. Navigate to **Operations > Day Labor**, filter by week ending date, and click **Close Week**.

- Closed entries are read-only and cannot be edited.
- Closing a week does not automatically create an accounting transaction — you must create the payment entry manually in **Accounting > Transactions**.

> **Jornalero registry**
> Registered day workers are maintained in **Operations > Jornaleros**, which records their cédula and active status. You can record entries for unregistered workers using free text in the Worker Name field, but registered workers are preferred for payroll reporting and identity verification.

---

## 5.8 Cronograma (Weekly Work Schedule)

The Cronograma is the weekly work plan for all permanent employees and registered day workers. It shows each worker's assigned task for each day and time slot (morning / afternoon) for the current week.

### 5.8.1 Navigating the Cronograma

Navigate to **Operations > Cronograma**. The view shows the current week (Monday through Saturday) with each worker as a row and each day-and-slot as a column. Use the week arrows to navigate to previous or future weeks.

- Week ending dates run Saturday-to-Saturday. Eight weeks are currently open.
- Employees appear with type **Employee**; day workers with type **Jornalero**.
- Morning and afternoon slots are tracked separately.
- Days 1–6 correspond to Monday through Saturday.

### 5.8.2 Adding a Cronograma Entry

Click on any empty cell in the grid (worker × day × slot) to create a new entry.

| Field | Required? | Description |
|---|---|---|
| Task | Recommended | The operation or task the worker is assigned to. Free text. |
| Is Holiday | Optional | Check if this slot falls on a public holiday. Affects payroll calculation. |
| Is Vacation | Optional | Check if the worker is on approved vacation. Affects payroll calculation. |

> **Cronograma and payroll**
> The cronograma feeds directly into the payroll module. Marking a slot as Is Holiday or Is Vacation here triggers the corresponding pay rule when payroll is processed. Always keep the cronograma up to date before closing a payroll period.

---

## 5.9 Service Contracts

The Service Contracts module tracks third-party equipment or labor contracts billed by the unit — typically by hour, hectare, or ton.

### 5.9.1 Creating a Service Contract

Navigate to **Operations > Service Contracts > + New Contract**.

| Field | Required? | Description |
|---|---|---|
| Contract Name | Required | A descriptive name identifying this engagement. |
| Owner / Contractor | Required | The name of the third-party company or individual. |
| Owner Cédula/RNC | Recommended | The contractor's tax ID. Required for DGII reporting when payments exceed reporting thresholds. |
| Operation Type | Required | Type of work being contracted (Excavator, Mowing, Harvest, Transport, Other). |
| Unit Type | Required | The billing unit: hours, hectares, or tons. |
| Price per Unit | Required | The agreed rate in DOP per unit. |
| Farm | Optional | The farm this contract is associated with. |
| Bank / Account | Optional | Contractor's bank details for payment reference. |
| Comments | Optional | Contract terms, notes, or references. |

### 5.9.2 Recording Work Entries

Each day or session of contracted work is logged as an entry. Open the contract and click **+ Add Entry**.

| Field | Required? | Description |
|---|---|---|
| Entry Date | Required | Date the work was performed. |
| Description | Required | Brief description of work done that day. |
| Units Charged | Required | Number of hours, hectares, or tons completed in this session. |
| Calculated Cost | Auto | Filled automatically as Units Charged × Price per Unit. |
| Cost Override | Optional | Enter a different amount if the session cost deviates from the standard rate. |
| Comments | Optional | Any notes about the session. |

### 5.9.3 Recording Payments

Payments are recorded under the contract's **Payments** tab. Click **+ Add Payment**.

1. Enter the payment date, amount in DOP, and any notes.
2. In the **Transaction** field, link the payment to an existing accounting transaction (created in **Accounting > Transactions**). This creates the formal audit trail between the operational record and the financial ledger.
3. Click **Save**. The contract's outstanding balance updates automatically.

> **Contract balance**
> The contract detail view shows total work value (sum of all entries), total paid (sum of all payments), and outstanding balance.

---

## 5.10 Rainfall Records

The Rainfall module captures daily precipitation readings from four weather measurement stations across the farm.

### 5.10.1 Recording a Rainfall Reading

Navigate to **Operations > Rainfall > + New Reading**.

| Field | Required? | Description |
|---|---|---|
| Date | Required | The measurement date. Each date can only have one record. |
| Palmarito (mm) | Recommended | Rainfall in millimeters at the Palmarito station. |
| Solar (mm) | Recommended | Rainfall in millimeters at the Solar station. |
| Virgencita (mm) | Recommended | Rainfall in millimeters at the La Virgencita station. |
| Caoba (mm) | Recommended | Rainfall in millimeters at the Caoba station. |

Leave a station field blank if that gauge was not read that day — do not enter 0 unless rain was actually measured as zero. A blank value means "not recorded"; a zero value means "no rain."

> **Rainfall and operation planning**
> A best practice is to enter rainfall readings every morning before logging field operations. High rainfall events (above 20 mm) typically affect whether spraying or soil-contact operations should proceed. Supervisors can reference the last 7 days of rainfall from the Cronograma view to inform the day's work plan.

---

## 5.11 Common Scenarios

| Scenario | How to record it |
|---|---|
| Spraying operation with product mix | Create a Field Operation (type: Pulverizar), select tractor and sprayer implement, enter start/end hours. After saving, add each product as an Input (e.g., Revolver 6.2 L + Abland 0.91 L). Enter hectares done. |
| Manual weeding with day workers | Create a Field Operation (type: Deshierbo manual or Chapeo manual), leave Tractor blank, enter Workers Count. Also create a Day Labor entry for the same date and field to record the payment amount. |
| Tractor fuel-up at the Mobile tank | Create a Fuel Transaction (Dispense), select Mobile tank and the tractor, enter pump start/end readings, gallons, and current hour meter. If submitted via the driver portal, approve from Pending Submissions instead. |
| Diesel delivery to Main Tank | Create a Fuel Transaction (Refill), select Main Tank, enter gallons and supplier name in Notes. Then create an Accounting Transaction for the cost (Chapter 4). |
| Oil change on JD3006 | Navigate to Equipment > JD3006 > Maintenance tab > + Log Maintenance. Set type to Routine, enter today's hour meter reading, note the oil grade and filter used. |
| Weekly jornalero payment | Verify all day labor entries for the week, close the week, then create a transaction in Accounting > Transactions for the total weekly amount. |
| Third-party excavator hired for one day | Create a Service Contract (or add an entry to an existing one). Record units (hours worked). After payment, add a Payment record linked to the corresponding accounting transaction. |
| Herbicide running low | Check Operations > Inventory for current stock. When the purchase arrives, record an Inventory Purchase entry and create an Accounting Transaction for the cost. |

---

## 5.12 Quick Reference — Who Does What

| Task | Admin | Management | Supervisor | Accountant |
|---|:---:|:---:|:---:|:---:|
| Create / edit field operations | ✓ | ✓ | ✓ | ✓ |
| Log fuel dispense / refill | ✓ | ✓ | ✓ | ✓ |
| Log maintenance event | ✓ | ✓ | ✓ | ✓ |
| Record inventory purchase | ✓ | ✓ | ✓ | ✓ |
| Add inventory inputs to operation | ✓ | ✓ | ✓ | ✓ |
| Create day labor entry | ✓ | ✓ | ✓ | ✓ |
| Close a day labor week | ✓ | ✓ | ✓ | ✓ |
| Edit cronograma entries | ✓ | ✓ | ✓ | ✓ |
| Create / manage service contracts | ✓ | ✓ | — | ✓ |
| Add service contract payment | ✓ | ✓ | — | ✓ |
| Record rainfall | ✓ | ✓ | ✓ | ✓ |
| Add / deactivate farms & fields | ✓ | ✓ | — | — |
| Add / deactivate equipment | ✓ | ✓ | — | — |
| Add operation types | ✓ | — | — | — |
| Approve driver portal submissions | ✓ | ✓ | ✓ | ✓ |

---

## 5.13 Related Chapters

- **Chapter 4: Registering Transactions** — recording financial costs linked to operations
- **Chapter 6: Journal Entries** — how operational costs post to the general ledger
- **Chapter 9: HR and Payroll** — permanent employee time tracking and payroll processing
- **Chapter 10: DGII Reports** — how service contract and day labor payments appear in 606 filings
