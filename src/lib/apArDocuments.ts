import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fmtMoney = (n: number, ccy = "DOP") =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: ccy, minimumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d: string | Date) =>
  format(typeof d === "string" ? new Date(d) : d, "dd/MM/yyyy", { locale: es }).toUpperCase();

interface Header {
  entityName: string;
  entityRnc?: string | null;
  contactName: string;
  contactRnc?: string | null;
}

export interface RemittanceLine {
  document_number: string | null;
  document_date: string;
  total_amount: number;
  amount_paid_now: number;
  balance_after: number;
  currency: string;
}

export function generateRemittanceAdvice(opts: {
  header: Header;
  paymentDate: string;
  paymentAmount: number;
  paymentCurrency: string;
  paymentMethod?: string | null;
  bankName?: string | null;
  reference?: string | null;
  notes?: string | null;
  lines: RemittanceLine[];
}): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("AVISO DE REMESA / REMITTANCE ADVICE", W / 2, y, { align: "center" }); y += 8;

  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(opts.header.entityName, 15, y);
  if (opts.header.entityRnc) doc.text(`RNC: ${opts.header.entityRnc}`, W - 15, y, { align: "right" });
  y += 6;

  doc.setDrawColor(180); doc.line(15, y, W - 15, y); y += 6;

  doc.setFont("helvetica", "bold"); doc.text("Pagado a:", 15, y);
  doc.setFont("helvetica", "normal");
  doc.text(opts.header.contactName, 35, y);
  if (opts.header.contactRnc) doc.text(`RNC: ${opts.header.contactRnc}`, W - 15, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "bold"); doc.text("Fecha:", 15, y);
  doc.setFont("helvetica", "normal"); doc.text(fmtDate(opts.paymentDate), 35, y);

  doc.setFont("helvetica", "bold"); doc.text("Método:", 90, y);
  doc.setFont("helvetica", "normal"); doc.text(opts.paymentMethod || "—", 110, y);
  y += 5;

  if (opts.bankName) {
    doc.setFont("helvetica", "bold"); doc.text("Banco:", 15, y);
    doc.setFont("helvetica", "normal"); doc.text(opts.bankName, 35, y); y += 5;
  }
  if (opts.reference) {
    doc.setFont("helvetica", "bold"); doc.text("Ref:", 15, y);
    doc.setFont("helvetica", "normal"); doc.text(opts.reference, 35, y); y += 5;
  }

  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Documento", "Fecha", "Total", "Aplicado", "Saldo", "Mon."]],
    body: opts.lines.map(l => [
      l.document_number || "—",
      fmtDate(l.document_date),
      fmtMoney(l.total_amount, l.currency),
      fmtMoney(l.amount_paid_now, l.currency),
      fmtMoney(l.balance_after, l.currency),
      l.currency,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 111, 92], textColor: 255 },
    foot: [["", "", "TOTAL PAGO", fmtMoney(opts.paymentAmount, opts.paymentCurrency), "", opts.paymentCurrency]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (opts.notes) {
    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text(`Notas: ${opts.notes}`, 15, finalY, { maxWidth: W - 30 });
  }

  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(
    `Generado: ${fmtDate(new Date())}`,
    W - 15, doc.internal.pageSize.getHeight() - 10, { align: "right" }
  );
  return doc;
}

export interface StatementLine {
  date: string;
  reference: string;
  description: string;
  charge: number;
  credit: number;
  balance: number;
  currency: string;
}

export function generateCustomerStatement(opts: {
  header: Header;
  asOf: string;
  currency: string;
  lines: StatementLine[];
  totalOutstanding: number;
  agingBuckets?: { current: number; d30: number; d60: number; d90: number; d90plus: number };
}): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("ESTADO DE CUENTA / STATEMENT", W / 2, y, { align: "center" }); y += 8;

  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(opts.header.entityName, 15, y);
  if (opts.header.entityRnc) doc.text(`RNC: ${opts.header.entityRnc}`, W - 15, y, { align: "right" });
  y += 6;
  doc.setDrawColor(180); doc.line(15, y, W - 15, y); y += 6;

  doc.setFont("helvetica", "bold"); doc.text("Cliente:", 15, y);
  doc.setFont("helvetica", "normal"); doc.text(opts.header.contactName, 35, y);
  if (opts.header.contactRnc) doc.text(`RNC: ${opts.header.contactRnc}`, W - 15, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "bold"); doc.text("Al:", 15, y);
  doc.setFont("helvetica", "normal"); doc.text(fmtDate(opts.asOf), 35, y);
  doc.setFont("helvetica", "bold"); doc.text("Moneda:", 90, y);
  doc.setFont("helvetica", "normal"); doc.text(opts.currency, 110, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Referencia", "Descripción", "Cargo", "Abono", "Saldo"]],
    body: opts.lines.map(l => [
      fmtDate(l.date),
      l.reference,
      l.description,
      l.charge ? fmtMoney(l.charge, l.currency) : "",
      l.credit ? fmtMoney(l.credit, l.currency) : "",
      fmtMoney(l.balance, l.currency),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 111, 92], textColor: 255 },
    foot: [["", "", "SALDO PENDIENTE", "", "", fmtMoney(opts.totalOutstanding, opts.currency)]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 8;

  if (opts.agingBuckets) {
    autoTable(doc, {
      startY: finalY,
      head: [["Corriente", "1-30 días", "31-60 días", "61-90 días", "+90 días"]],
      body: [[
        fmtMoney(opts.agingBuckets.current, opts.currency),
        fmtMoney(opts.agingBuckets.d30, opts.currency),
        fmtMoney(opts.agingBuckets.d60, opts.currency),
        fmtMoney(opts.agingBuckets.d90, opts.currency),
        fmtMoney(opts.agingBuckets.d90plus, opts.currency),
      ]],
      styles: { fontSize: 9, halign: "right" },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, halign: "center" },
    });
    finalY = (doc as any).lastAutoTable.finalY + 6;
  }

  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(
    `Generado: ${fmtDate(new Date())}`,
    W - 15, doc.internal.pageSize.getHeight() - 10, { align: "right" }
  );
  return doc;
}
