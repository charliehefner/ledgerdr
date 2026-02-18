// DGII code mappings for Dominican Republic tax reports

export const TIPO_BIENES_SERVICIOS: Record<string, string> = {
  "01": "Gastos de Personal",
  "02": "Gastos por Trabajos, Suministros y Servicios",
  "03": "Arrendamientos",
  "04": "Gastos de Activos Fijos",
  "05": "Gastos de Representación",
  "06": "Otras Deducciones Admitidas",
  "07": "Gastos Financieros",
  "08": "Gastos Extraordinarios",
  "09": "Compras y Gastos que forman parte del Costo de Venta",
  "10": "Adquisiciones de Activos",
  "11": "Gastos de Seguros",
  "12": "Gastos de Depreciación",
  "13": "Otros Gastos",
};

export const TIPO_INGRESO: Record<string, string> = {
  "01": "Ingresos por Operaciones (No Financieros)",
  "02": "Ingresos Financieros",
  "03": "Ingresos Extraordinarios",
  "04": "Ingresos por Arrendamientos",
  "05": "Ingresos por Venta de Activo Depreciable",
  "06": "Otros Ingresos",
};

export const TIPO_ANULACION: Record<string, string> = {
  "01": "Deterioro de Factura Pre-Impresa",
  "02": "Errores de Impresión (Factura Pre-Impresa)",
  "03": "Impresión Defectuosa",
  "04": "Corrección de la Información",
  "05": "Cambio de Productos",
  "06": "Devolución de Productos",
  "07": "Omisión de Productos",
  "08": "Errores en Secuencia de NCF",
  "09": "Por Cese de Operaciones",
  "10": "Pérdida o Hurto de Talonarios",
};

// Map internal pay_method values to DGII Forma de Pago codes
export const PAY_METHOD_TO_DGII: Record<string, string> = {
  cash: "01",
  transfer_bdi: "02",
  transfer_bhd: "02",
  "Transfer BHD": "02",
  check: "02",
  cc_management: "04",
  cc_industry: "04",
  credit: "05",
};

export const FORMA_DE_PAGO: Record<string, string> = {
  "01": "Efectivo",
  "02": "Cheques/Transferencias/Depósitos",
  "03": "Tarjeta de Débito/Crédito",
  "04": "Compra a Crédito",
  "05": "Permuta",
  "06": "Nota de Crédito",
  "07": "Mixto",
};

export function getTipoId(rnc: string | null): string {
  if (!rnc) return "";
  const clean = rnc.replace(/[-\s]/g, "");
  if (clean.length === 9) return "1"; // RNC
  if (clean.length === 11) return "2"; // Cedula
  return "";
}

export function formatDateDGII(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
}

export function getFormaDePago(payMethod: string | null): string {
  if (!payMethod) return "";
  return PAY_METHOD_TO_DGII[payMethod] || "01";
}
