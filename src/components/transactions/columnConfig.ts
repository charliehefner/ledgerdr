import { ColumnConfig } from "@/hooks/useColumnVisibility";

/**
 * Standardized bilingual column configuration for all transaction tables.
 * Used across Dashboard, Transactions (Recent), and Reports (Ledger).
 * Labels use "English / Spanish" format for consistent display in the column selector.
 */
export const TRANSACTION_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "Date / Fecha", defaultVisible: true },
  { key: "dueDate", label: "Due Date / Fecha Vencimiento", defaultVisible: true },
  { key: "account", label: "Account / Cuenta", defaultVisible: true },
  { key: "project", label: "Project / Proyecto", defaultVisible: false },
  { key: "cbsCode", label: "CBS Code / Código CBS", defaultVisible: false },
  { key: "purchaseDate", label: "Purchase Date / Fecha Compra", defaultVisible: false },
  { key: "description", label: "Description / Descripción", defaultVisible: true },
  { key: "currency", label: "Currency / Moneda", defaultVisible: true },
  { key: "amount", label: "Amount / Monto", defaultVisible: true },
  { key: "amountDop", label: "Amount DOP / Monto RD$", defaultVisible: false },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Pay Method / Método Pago", defaultVisible: true },
  { key: "document", label: "Document / Documento", defaultVisible: true },
  { key: "name", label: "Name / Nombre", defaultVisible: false },
  { key: "comments", label: "Comments / Comentarios", defaultVisible: false },
  { key: "exchangeRate", label: "Exchange Rate / Tasa Cambio", defaultVisible: false },
  { key: "costCenter", label: "Cost Center / Centro Costo", defaultVisible: false },
  { key: "attach", label: "Attachment / Adjunto", defaultVisible: true },
];

/**
 * Configuration for Reports page with additional columns visible by default.
 * Extends the standard transaction columns with report-specific defaults.
 */
export const REPORT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: false },
  { key: "date", label: "Date / Fecha", defaultVisible: true },
  { key: "dueDate", label: "Due Date / Fecha Vencimiento", defaultVisible: true },
  { key: "account", label: "Account / Cuenta", defaultVisible: true },
  { key: "project", label: "Project / Proyecto", defaultVisible: true },
  { key: "cbsCode", label: "CBS Code / Código CBS", defaultVisible: true },
  { key: "purchaseDate", label: "Purchase Date / Fecha Compra", defaultVisible: false },
  { key: "description", label: "Description / Descripción", defaultVisible: true },
  { key: "currency", label: "Currency / Moneda", defaultVisible: true },
  { key: "amount", label: "Amount / Monto", defaultVisible: true },
  { key: "amountDop", label: "Amount DOP / Monto RD$", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: true },
  { key: "payMethod", label: "Pay Method / Método Pago", defaultVisible: true },
  { key: "document", label: "Document / Documento", defaultVisible: true },
  { key: "name", label: "Name / Nombre", defaultVisible: true },
  { key: "comments", label: "Comments / Comentarios", defaultVisible: false },
  { key: "exchangeRate", label: "Exchange Rate / Tasa Cambio", defaultVisible: true },
  { key: "costCenter", label: "Cost Center / Centro Costo", defaultVisible: true },
  { key: "attach", label: "Attachment / Adjunto", defaultVisible: true },
];

/**
 * Configuration for Dashboard tables (Pending NCF, Without Payment Receipt).
 * Uses the standard transaction columns with dashboard-specific defaults.
 */
export const DASHBOARD_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "Date / Fecha", defaultVisible: true },
  { key: "dueDate", label: "Due Date / Fecha Vencimiento", defaultVisible: false },
  { key: "account", label: "Account / Cuenta", defaultVisible: true },
  { key: "project", label: "Project / Proyecto", defaultVisible: false },
  { key: "cbsCode", label: "CBS Code / Código CBS", defaultVisible: false },
  { key: "purchaseDate", label: "Purchase Date / Fecha Compra", defaultVisible: false },
  { key: "description", label: "Description / Descripción", defaultVisible: true },
  { key: "currency", label: "Currency / Moneda", defaultVisible: true },
  { key: "amount", label: "Amount / Monto", defaultVisible: true },
  { key: "amountDop", label: "Amount DOP / Monto RD$", defaultVisible: false },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Pay Method / Método Pago", defaultVisible: false },
  { key: "document", label: "Document / Documento", defaultVisible: true },
  { key: "name", label: "Name / Nombre", defaultVisible: false },
  { key: "comments", label: "Comments / Comentarios", defaultVisible: false },
  { key: "exchangeRate", label: "Exchange Rate / Tasa Cambio", defaultVisible: false },
  { key: "costCenter", label: "Cost Center / Centro Costo", defaultVisible: false },
  { key: "attach", label: "Attachment / Adjunto", defaultVisible: true },
];
