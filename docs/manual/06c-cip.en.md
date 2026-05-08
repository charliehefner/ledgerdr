# Chapter 6c — CIP (Construction in Progress)

## 1. Purpose

CIP — Construction in Progress — is the parking place for the cost of an asset that is being built or assembled but is not yet ready to use. The module accumulates every cost associated with the project (materials, equipment contributions from the parent, supplier invoices, manual entries) on a designated CIP account. Once the project is operational, the accumulated balance is **capitalized** to a fixed asset, depreciation begins, and the project itself is closed.

In short, CIP keeps the in-flight cost of long-running asset projects out of expense and out of the regular fixed-asset register until the asset actually starts producing value.

## 2. Roles and permissions

Access to CIP is governed by role. "read" is view-only and "—" means the action is unavailable.

| Action | Admin | Management | Accountant | Others |
|---|---|---|---|---|
| View CIP projects | ✓ | ✓ | ✓ | read |
| Create project | ✓ | ✓ | ✓ | — |
| Capitalize | ✓ | ✓ | ✓ | — |

## 3. Screen tour

The module lives under Accounting → **CIP** tab.

- A table listing each project with its name, CIP account (1080 / 1180 / 1280), accumulated DOP balance, status (`open` or `capitalized`), and placed-in-service date.
- A **New project** button at the top. For any open project with a balance greater than zero, a **Capitalize** action appears on its row.

> [SCREENSHOT: CIP project table]

## 4. Step-by-step workflows

This section covers the three things you do with a CIP project: create it, accumulate cost into it, and eventually capitalize it.

### 4.1 Create a project

1. Click **New project**.
2. Capture the name, the target CIP account, and a description.
3. Available CIP accounts depend on what is being built:
   - **1080** — Advances / intangibles in progress
   - **1180** — Construction in progress (land / buildings)
   - **1280** — Machinery and equipment in progress
4. Click **Create**. The project starts in status `open`.

> [SCREENSHOT: New CIP project form with account selector]

### 4.2 Accumulate costs

Costs can reach the CIP project through three different paths, each one tied to a different module.

- A Home Office advance of kind *Equipment (CIP)* (see Chapter 6b).
- A supplier invoice whose target account is the project's CIP account (see Chapter 4).
- A manual journal (see Chapter 6a) using the CIP account together with the `cip_project` dimension.

The accumulated balance shown on the project row is computed by summing the active advances linked to the project through `home_office_advances.cip_project_id`.

### 4.3 Capitalize

Capitalization is the final step: when the project becomes operational, its accumulated balance is moved out of CIP and into a real fixed asset.

1. On the project row, click **Capitalize**.
2. Capture:
   - Asset name.
   - Serial number or plate, when applicable.
   - Target asset account (the picker is filtered to chart accounts where `account_type = ASSET` and the account is postable).
   - Placed-in-service date.
   - Useful life in months (defaults to 60).
   - Salvage value.
3. Click **Capitalize**. The RPC `capitalize_cip_project` then does the following:
   - Creates the `fixed_asset` record with cost equal to the accumulated balance.
   - Posts **Dr [asset account] / Cr [CIP account]** for the full amount.
   - Marks the project as `capitalized` and stores the `placed_in_service_date`.
   - The asset is now eligible for monthly straight-line depreciation in the DEP journal (see Chapter 8).

> [SCREENSHOT: Capitalize dialog with useful-life and salvage fields]

## 5. Business rules and validations

The rules below keep CIP balances clean and the eventual fixed-asset register accurate.

- Only an **open project with a balance greater than zero** can be capitalized.
- Capitalization is **all-or-nothing**: the entire accumulated balance moves to the fixed asset. If you need to split a project across multiple assets, create separate CIP projects from the start.
- The placed-in-service date must be on or after the most recent contribution date — you cannot place an asset in service before its last cost.
- Once a project is `capitalized`, it becomes immutable; historical advances and entries linked to it no longer accept edits.

## 6. Accounting impact

| Operation | Journal |
|---|---|
| Accumulation (HO advance) | Dr 1080/1180/1280 / Cr 2160 |
| Accumulation (invoice) | Dr 1080/1180/1280 / Cr 2110 |
| Capitalization | Dr [asset, e.g. 1230] / Cr 1080/1180/1280 |
| Subsequent depreciation | Dr 7150 / Cr 1450 (handled by Fixed Assets) |

The CIP accounts (1080 / 1180 / 1280) should always net to the sum of the open projects shown in the tab. A drilldown of any of those accounts on the balance sheet should match this view.

## 7. Common errors

- **"No CIP projects"** when recording a Home Office advance of kind CIP — create the project first on this tab, then record the advance.
- **"Asset account required"** at capitalization — select a postable chart account in the 1xxx range.
- **Zero balance when trying to capitalize** — no advances are linked to the project. Use the CIP-account drilldown on the balance sheet to locate movements that may have been posted with the wrong project dimension.

## 8. Related chapters

- Chapter 6b — Home Office
- Chapter 4 — Purchasing (invoices with a CIP account)
- Chapter 8 — Fixed Assets (subsequent depreciation)

## Glossary

- **CIP (Construction in Progress)** — A holding category for the cost of an asset being built or assembled but not yet placed in service.
- **CIP project** — A specific, named accumulation bucket inside CIP, tied to one of the CIP accounts.
- **Account 1080** — Advances and intangibles in progress.
- **Account 1180** — Construction in progress for land and buildings.
- **Account 1280** — Machinery and equipment in progress.
- **Capitalization** — The act of moving a CIP project's accumulated cost out of CIP and into a fixed asset, at which point depreciation begins.
- **Placed-in-service date** — The date the asset begins to produce value; depreciation starts from this date.
- **Useful life** — The number of months over which the asset is depreciated (default 60).
- **Salvage value** — The estimated residual value of the asset at the end of its useful life.
- **DEP journal** — The depreciation journal handled by the Fixed Assets module (see Chapter 8).
- **`capitalize_cip_project`** — Backend RPC that creates the fixed asset, posts the reclassification entry, and closes the project.
- **`cip_project` dimension** — The journal-line dimension that ties manual entries to a specific CIP project.
