# Chapter 6c — CIP (Construction in Progress)

## 1. Purpose

CIP accumulates costs of an asset not yet ready for use. Once complete, the
accumulated balance is **capitalized** to a fixed asset, depreciation begins,
and the project closes.

## 2. Roles and permissions

| Action | Admin | Management | Accountant | Others |
|---|---|---|---|---|
| View CIP projects | ✓ | ✓ | ✓ | read |
| Create project | ✓ | ✓ | ✓ | — |
| Capitalize | ✓ | ✓ | ✓ | — |

## 3. Screen tour

Accounting → **CIP** tab:

- Table with: name, CIP account (1080 / 1180 / 1280), accumulated DOP
  balance, status (`open` / `capitalized`), placed-in-service date.
- **New project** button. For each open project with balance > 0, a
  **Capitalize** action appears.

> [SCREENSHOT: CIP project table]

## 4. Step-by-step workflows

### 4.1 Create a project

1. **New project**.
2. Capture name, target CIP account, description.
3. Available CIP accounts:
   - **1080** — Advances / intangibles in progress
   - **1180** — Construction in progress (land / buildings)
   - **1280** — Machinery and equipment in progress
4. Create. Initial status: `open`.

### 4.2 Accumulate costs

Costs reach the CIP three ways:

- Home Office advance of kind *Equipment (CIP)* (Chapter 6b).
- Supplier invoice with target = the project's CIP account (Chapter 4).
- Manual journal (Chapter 6a) using the CIP account and `cip_project`
  dimension.

Accumulated balance is computed by summing active advances linked to the
project (`home_office_advances.cip_project_id`).

### 4.3 Capitalize

When the project goes into operation:

1. Row → **Capitalize**.
2. Capture:
   - Asset name.
   - Serial / plate.
   - Target asset account (filtered to `account_type = ASSET`, postable).
   - Placed-in-service date.
   - Useful life in months (default 60).
   - Salvage value.
3. **Capitalize**. The RPC `capitalize_cip_project`:
   - Creates the `fixed_asset` with cost = accumulated balance.
   - Posts **Dr [asset account] / Cr [CIP account]** for the full amount.
   - Marks the project `capitalized` with `placed_in_service_date`.
   - The asset is now eligible for monthly straight-line depreciation in the
     DEP journal (see Chapter 8).

## 5. Business rules and validations

- Only an **open project with balance > 0** can be capitalized.
- Capitalization is **all-or-nothing**: the entire balance moves to the fixed
  asset. If you need to split, create separate projects from the start.
- Placed-in-service date must be ≥ the most recent contribution date.
- Once `capitalized`, the project is immutable; historical advances no
  longer accept edits.

## 6. Accounting impact

| Operation | Journal |
|---|---|
| Accumulation (HO advance) | Dr 1080/1180/1280 / Cr 2160 |
| Accumulation (invoice) | Dr 1080/1180/1280 / Cr 2110 |
| Capitalization | Dr [asset, e.g. 1230] / Cr 1080/1180/1280 |
| Subsequent depreciation | Dr 7150 / Cr 1450 (handled by Fixed Assets) |

## 7. Common errors

- **"No CIP projects"** when recording an HO advance of kind CIP — create the
  project first on this tab.
- **"Asset account required"** at capitalization — select a postable chart
  account (1xxx).
- **Zero balance when trying to capitalize** — no linked advances; use the
  CIP-account drilldown on the balance sheet to locate missing movements.

## 8. Related chapters

- Chapter 6b — Home Office
- Chapter 4 — Purchasing (invoices with a CIP account)
- Chapter 8 — Fixed Assets (subsequent depreciation)
