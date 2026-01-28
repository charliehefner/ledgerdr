import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EmployeeBenefit {
  benefit_type: string;
  amount: number;
}

interface PayrollData {
  employee: {
    id: string;
    name: string;
    position: string;
    salary: number;
    bank: string | null;
    bank_account_number: string | null;
  };
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  vacationDays: number;
  basePay: number;
  overtimePay: number;
  holidayPay: number;
  benefits: EmployeeBenefit[];
  totalBenefits: number;
  tss: number;
  isr: number;
  absenceDeduction: number;
  vacationDeduction: number;
  loanDeduction: number;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(amount);

/**
 * Generates a single payment receipt PDF for an employee.
 * Two-up layout: one copy for records, one for employee.
 */
function generateEmployeeReceipt(
  data: PayrollData,
  nominaNumber: number,
  periodStart: Date,
  periodEnd: Date
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const periodStr = `${format(periodStart, "dd/MM/yyyy")} - ${format(periodEnd, "dd/MM/yyyy")}`;

  // Generate receipt content for both copies (top and bottom half)
  const generateReceiptContent = (yOffset: number) => {
    const startY = yOffset;
    let y = startY + 8;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAGO", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Nómina ${nominaNumber} | Período: ${periodStr}`, pageWidth / 2, y, { align: "center" });
    y += 10;

    // Employee Details Box
    doc.setDrawColor(200);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(15, y, pageWidth - 30, 22, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Empleado:", 20, y + 6);
    doc.text("Cargo:", 20, y + 12);
    doc.text("Salario Mensual:", 20, y + 18);

    doc.setFont("helvetica", "normal");
    doc.text(data.employee.name, 55, y + 6);
    doc.text(data.employee.position, 55, y + 12);
    doc.text(formatCurrency(data.employee.salary), 55, y + 18);

    // Bank info on the right
    if (data.employee.bank) {
      doc.setFont("helvetica", "bold");
      doc.text("Banco:", 115, y + 6);
      doc.text("Cuenta:", 115, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text(data.employee.bank, 135, y + 6);
      doc.text(data.employee.bank_account_number || "-", 135, y + 12);
    }

    y += 28;

    // Two-column layout for earnings and deductions
    const colWidth = (pageWidth - 40) / 2;
    const leftX = 15;
    const rightX = leftX + colWidth + 10;

    // EARNINGS Column
    doc.setFillColor(232, 245, 233); // Light green
    doc.roundedRect(leftX, y, colWidth, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("INGRESOS", leftX + 3, y + 5.5);
    y += 10;

    const earnings = [
      { label: "Salario Base (Quincenal)", value: data.basePay },
      { label: `Horas Extras (${data.overtimeHours.toFixed(1)} hrs)`, value: data.overtimePay },
      { label: `Bono Feriado (${data.holidayHours.toFixed(1)} hrs)`, value: data.holidayPay },
    ];

    // Add benefits
    data.benefits.forEach((b) => {
      earnings.push({ label: b.benefit_type, value: b.amount });
    });

    let earningsY = y;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    earnings.forEach((item) => {
      if (item.value > 0) {
        doc.text(item.label, leftX + 3, earningsY);
        doc.text(formatCurrency(item.value), leftX + colWidth - 3, earningsY, { align: "right" });
        earningsY += 5;
      }
    });

    // Gross total
    earningsY += 2;
    doc.setDrawColor(76, 175, 80);
    doc.line(leftX + 3, earningsY, leftX + colWidth - 3, earningsY);
    earningsY += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Total Ingresos", leftX + 3, earningsY);
    doc.text(formatCurrency(data.grossPay), leftX + colWidth - 3, earningsY, { align: "right" });

    // DEDUCTIONS Column
    let dedY = y - 10;
    doc.setFillColor(255, 235, 238); // Light red
    doc.roundedRect(rightX, dedY, colWidth, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DEDUCCIONES", rightX + 3, dedY + 5.5);
    dedY += 10;

    const deductions = [
      { label: "TSS (AFP + SFS)", value: data.tss },
      { label: "ISR", value: data.isr },
      { label: `Ausencias`, value: data.absenceDeduction },
      { label: `Vacaciones (${data.vacationDays} días)`, value: data.vacationDeduction },
      { label: `Préstamo`, value: data.loanDeduction },
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    deductions.forEach((item) => {
      if (item.value > 0) {
        doc.text(item.label, rightX + 3, dedY);
        doc.text(formatCurrency(item.value), rightX + colWidth - 3, dedY, { align: "right" });
        dedY += 5;
      }
    });

    // Deductions total
    dedY += 2;
    doc.setDrawColor(244, 67, 54);
    doc.line(rightX + 3, dedY, rightX + colWidth - 3, dedY);
    dedY += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Total Deducciones", rightX + 3, dedY);
    doc.text(formatCurrency(data.totalDeductions), rightX + colWidth - 3, dedY, { align: "right" });

    // NET PAY Box
    const maxY = Math.max(earningsY, dedY);
    const netPayY = maxY + 10;

    doc.setFillColor(33, 150, 243); // Blue
    doc.roundedRect(15, netPayY, pageWidth - 30, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PAGO NETO:", 25, netPayY + 8);
    doc.setFontSize(14);
    doc.text(formatCurrency(data.netPay), pageWidth - 25, netPayY + 8, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Signature lines
    const sigY = netPayY + 22;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(150);

    doc.line(25, sigY, 85, sigY);
    doc.text("Firma del Empleado", 55, sigY + 4, { align: "center" });

    doc.line(pageWidth - 85, sigY, pageWidth - 25, sigY);
    doc.text("Firma Autorizada", pageWidth - 55, sigY + 4, { align: "center" });

    // Copy label
    const copyLabel = yOffset === 0 ? "COPIA EMPRESA" : "COPIA EMPLEADO";
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(copyLabel, pageWidth - 20, startY + 5, { align: "right" });
    doc.setTextColor(0);

    return sigY + 8;
  };

  // Generate two copies
  generateReceiptContent(5);

  // Dashed cutting line
  const middleY = 140;
  doc.setDrawColor(150);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(10, middleY, pageWidth - 10, middleY);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text("✂ CORTAR AQUÍ", pageWidth / 2, middleY - 2, { align: "center" });
  doc.setTextColor(0);

  generateReceiptContent(145);

  return doc;
}

/**
 * Generates individual PDF receipts for all employees and bundles them in a ZIP file.
 */
export async function generatePayrollReceiptsZip(
  payrollData: PayrollData[],
  nominaNumber: number,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  const zip = new JSZip();
  const periodStr = format(periodStart, "yyyy-MM-dd");

  for (const data of payrollData) {
    const doc = generateEmployeeReceipt(data, nominaNumber, periodStart, periodEnd);
    const pdfBlob = doc.output("blob");

    // Sanitize employee name for filename
    const safeName = data.employee.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");

    zip.file(`Recibo_Nomina${nominaNumber}_${safeName}.pdf`, pdfBlob);
  }

  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Recibos_Nomina_${nominaNumber}_${periodStr}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates a single employee receipt for preview/download.
 */
export function downloadSingleReceipt(
  data: PayrollData,
  nominaNumber: number,
  periodStart: Date,
  periodEnd: Date
): void {
  const doc = generateEmployeeReceipt(data, nominaNumber, periodStart, periodEnd);

  const safeName = data.employee.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");

  doc.save(`Recibo_Nomina${nominaNumber}_${safeName}.pdf`);
}
