import jsPDF from "jspdf";
import JSZip from "jszip";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";

interface DayLaborEntry {
  work_date: string;
  operation_description: string;
  worker_name: string;
  amount: number;
}

interface WorkerGroup {
  name: string;
  entries: DayLaborEntry[];
  subtotal: number;
}

interface Jornalero {
  name: string;
  cedula: string;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(amount);

/**
 * Group entries by operation_description (case-insensitive),
 * collapse same-description entries into date ranges with summed amounts.
 */
function groupTaskEntries(entries: DayLaborEntry[]): { dateLabel: string; description: string; amount: number }[] {
  const groups = new Map<string, { description: string; dates: string[]; total: number }>();

  for (const entry of entries) {
    const key = entry.operation_description.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      if (!existing.dates.includes(entry.work_date)) {
        existing.dates.push(entry.work_date);
      }
      existing.total += Number(entry.amount);
    } else {
      groups.set(key, {
        description: entry.operation_description, // preserve original casing
        dates: [entry.work_date],
        total: Number(entry.amount),
      });
    }
  }

  const rows: { dateLabel: string; description: string; amount: number }[] = [];
  for (const group of groups.values()) {
    group.dates.sort();
    let dateLabel: string;
    if (group.dates.length === 1) {
      dateLabel = format(parseDateLocal(group.dates[0]), "dd/MM");
    } else {
      const first = format(parseDateLocal(group.dates[0]), "dd/MM");
      const last = format(parseDateLocal(group.dates[group.dates.length - 1]), "dd/MM");
      dateLabel = `${first} – ${last}`;
    }
    rows.push({ dateLabel, description: group.description, amount: group.total });
  }

  return rows;
}

/**
 * Generate a single two-up receipt PDF for a day laborer.
 */
function generateWorkerReceipt(
  workerName: string,
  cedula: string,
  taskRows: { dateLabel: string; description: string; amount: number }[],
  total: number,
  weekFriday: Date,
  weekStart: Date,
  weekEnd: Date
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const periodStr = `${format(weekStart, "dd/MM/yyyy")} - ${format(weekEnd, "dd/MM/yyyy")}`;
  const fridayStr = format(weekFriday, "dd/MM/yyyy");

  const generateCopy = (yOffset: number) => {
    let y = yOffset + 8;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE JORNAL", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Semana ${fridayStr} | Período: ${periodStr}`, pageWidth / 2, y, { align: "center" });
    y += 10;

    // Worker info box
    doc.setDrawColor(200);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(15, y, pageWidth - 30, 14, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Nombre:", 20, y + 6);
    doc.text("Cédula:", 20, y + 11);
    doc.setFont("helvetica", "normal");
    doc.text(workerName, 45, y + 6);
    doc.text(cedula || "—", 45, y + 11);

    y += 20;

    // Task table header
    doc.setFillColor(235, 235, 235);
    doc.roundedRect(15, y, pageWidth - 30, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Fecha(s)", 20, y + 5);
    doc.text("Descripción", 60, y + 5);
    doc.text("Monto", pageWidth - 20, y + 5, { align: "right" });
    y += 9;

    // Task rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const row of taskRows) {
      doc.text(row.dateLabel, 20, y);
      doc.text(row.description, 60, y);
      doc.text(formatCurrency(row.amount), pageWidth - 20, y, { align: "right" });
      y += 5;
    }

    // Total box
    y += 4;
    doc.setFillColor(160, 160, 160);
    doc.roundedRect(15, y, pageWidth - 30, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 25, y + 8);
    doc.setFontSize(14);
    doc.text(formatCurrency(total), pageWidth - 25, y + 8, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Signature lines
    const sigY = y + 22;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(150);
    doc.line(25, sigY, 85, sigY);
    doc.text("Firma del Trabajador", 55, sigY + 4, { align: "center" });
    doc.line(pageWidth - 85, sigY, pageWidth - 25, sigY);
    doc.text("Firma Autorizada", pageWidth - 55, sigY + 4, { align: "center" });

    // Copy label
    const copyLabel = yOffset === 0 ? "COPIA EMPRESA" : "COPIA TRABAJADOR";
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(copyLabel, pageWidth - 20, yOffset + 5, { align: "right" });
    doc.setTextColor(0);
  };

  // Top copy
  generateCopy(5);

  // Dashed cut line
  const middleY = 140;
  doc.setDrawColor(150);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(10, middleY, pageWidth - 10, middleY);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text("✂ CORTAR AQUÍ", pageWidth / 2, middleY - 2, { align: "center" });
  doc.setTextColor(0);

  // Bottom copy
  generateCopy(145);

  return doc;
}

/**
 * Generate individual receipts for all day labor workers and bundle into a ZIP.
 */
export async function generateDayLaborReceiptsZip(
  workerGroups: WorkerGroup[],
  jornaleros: Jornalero[],
  weekFriday: Date,
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  if (workerGroups.length === 0) return;

  // Build case-insensitive name → cedula map
  const cedulaMap = new Map<string, string>();
  for (const j of jornaleros) {
    cedulaMap.set(j.name.trim().toLowerCase(), j.cedula);
  }

  const zip = new JSZip();

  for (const group of workerGroups) {
    const cedula = cedulaMap.get(group.name.trim().toLowerCase()) || "";
    const taskRows = groupTaskEntries(group.entries);
    const doc = generateWorkerReceipt(
      group.name,
      cedula,
      taskRows,
      group.subtotal,
      weekFriday,
      weekStart,
      weekEnd
    );

    const pdfBlob = doc.output("blob");
    const safeName = group.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");

    zip.file(`Recibo_Jornal_${safeName}.pdf`, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Recibos_Jornal_${format(weekFriday, "yyyy-MM-dd")}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
