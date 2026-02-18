

# Change DGII Date Format to dd-mm-yyyy

## Change

Update the `formatDateDGII` function in `src/components/accounting/dgiiConstants.ts` to output dates as `dd-mm-yyyy` instead of `YYYYMMDD`.

**Current output:** `20260115`
**New output:** `15-01-2026`

## Scope

This single function change automatically applies to all three DGII reports (606, 607, 608) since they all call `formatDateDGII()` for the "Fecha Comprobante" column -- both in the on-screen table and in Copy/Excel exports.

## Technical Detail

**File:** `src/components/accounting/dgiiConstants.ts`

Change the return statement in `formatDateDGII` from:
```
return `${year}${month}${day}`;
```
to:
```
return `${day}-${month}-${year}`;
```

No other files need to be modified.
