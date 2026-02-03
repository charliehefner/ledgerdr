import { useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DayLaborEntry, WorkerSummary } from "./types";
import { formatDOP } from "./dayLaborUtils";
import { parseDateLocal } from "@/lib/dateUtils";

interface UseDayLaborExportParams {
  selectedFriday: Date;
  weekStart: Date;
  weekEnd: Date;
  summaryByWorker: WorkerSummary[];
  weeklyTotal: number;
}

export function useDayLaborExport({
  selectedFriday,
  weekStart,
  weekEnd,
  summaryByWorker,
  weeklyTotal,
}: UseDayLaborExportParams) {
  
  const generatePDF = useCallback(() => {
    const doc = new jsPDF();
    const fridayStr = format(selectedFriday, "dd/MM/yyyy");

    doc.setFontSize(18);
    doc.text(`Resumen Jornal - Semana ${fridayStr}`, 14, 20);

    doc.setFontSize(11);
    doc.text(
      `Período: ${format(weekStart, "dd/MM/yyyy")} - ${format(weekEnd, "dd/MM/yyyy")}`,
      14,
      30
    );

    const tableData: (string | { content: string; colSpan?: number; styles?: object })[][] = [];

    summaryByWorker.forEach((group) => {
      group.entries.forEach((entry, idx) => {
        tableData.push([
          format(parseDateLocal(entry.work_date), "dd/MM/yyyy"),
          entry.operation_description,
          idx === 0 ? group.name : "",
          formatDOP(Number(entry.amount)),
        ]);
      });
      // Subtotal row
      tableData.push([
        { content: "", colSpan: 2 },
        {
          content: `Subtotal ${group.name}:`,
          styles: { fontStyle: "bold", halign: "right" },
        },
        { content: formatDOP(group.subtotal), styles: { fontStyle: "bold" } },
      ] as any);
    });

    // Grand total row
    tableData.push([
      { content: "", colSpan: 2 },
      { content: "TOTAL:", styles: { fontStyle: "bold", halign: "right" } },
      { content: formatDOP(weeklyTotal), styles: { fontStyle: "bold" } },
    ] as any);

    autoTable(doc, {
      head: [["Fecha", "Descripción", "Nombre", "Monto"]],
      body: tableData,
      startY: 38,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`Resumen_Jornal_${format(selectedFriday, "yyyy-MM-dd")}.pdf`);
  }, [selectedFriday, weekStart, weekEnd, summaryByWorker, weeklyTotal]);

  return { generatePDF };
}
