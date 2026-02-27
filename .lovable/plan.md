

## Plan: Add IR-17 Tab to DGII Reports

The IR-17 report component already exists at `src/components/hr/IR17ReportView.tsx`. It just needs to be added as a new tab in the DGII section alongside the existing 606, 607, 608, IT-1, and IR-3 tabs.

### Changes

**File: `src/components/accounting/DGIIReportsView.tsx`**
1. Import `IR17ReportView` from `@/components/hr/IR17ReportView`
2. Add a new `TabsTrigger` for "IR-17 - Retenciones" after the IR-3 tab
3. Add a corresponding `TabsContent` rendering `<IR17ReportView />`

Single file, three lines of change.

