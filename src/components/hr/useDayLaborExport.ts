import { useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DayLaborEntry, WorkerSummary } from "./types";
import { formatDOP } from "./dayLaborUtils";
import { parseDateLocal, fmtDate } from "@/lib/dateUtils";

interface UseDayLaborExportParams {
  selectedFriday: Date;
  weekStart: Date;
  weekEnd: Date;
  summaryByWorker: WorkerSummary[];
  weeklyTotal: number;
}

/**
 * Check if File System Access API is supported
 */
function supportsFilePicker(): boolean {
  return "showSaveFilePicker" in window;
}

/**
 * Save file using File System Access API (Chrome/Edge) with fallback
 */
async function saveFileWithPicker(
  blob: Blob,
  suggestedName: string,
  fileType: { description: string; accept: Record<string, string[]> }
): Promise<boolean> {
  if (supportsFilePicker()) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (options: {
          suggestedName: string;
          types: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName,
        types: [fileType],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return false; // User cancelled
      }
      // Fall through to standard download
    }
  }

  // Fallback: standard download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export function useDayLaborExport({
  selectedFriday,
  weekStart,
  weekEnd,
  summaryByWorker,
  weeklyTotal,
}: UseDayLaborExportParams) {
  
  const generatePDF = useCallback(async () => {
    const doc = new jsPDF();
    const fridayStr = fmtDate(selectedFriday);

    doc.setFontSize(18);
    doc.text(`Resumen Jornal - Semana ${fridayStr}`, 14, 20);

    doc.setFontSize(11);
    doc.text(
      `Período: ${fmtDate(weekStart)} - ${fmtDate(weekEnd)}`,
      14,
      30
    );

    const tableData: (string | { content: string; colSpan?: number; styles?: object })[][] = [];

    summaryByWorker.forEach((group) => {
      group.entries.forEach((entry, idx) => {
        tableData.push([
          fmtDate(parseDateLocal(entry.work_date)),
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

    const pdfBlob = doc.output("blob");
    const filename = `Resumen_Jornal_${format(selectedFriday, "yyyy-MM-dd")}.pdf`;
    
    await saveFileWithPicker(pdfBlob, filename, {
      description: "PDF Document",
      accept: { "application/pdf": [".pdf"] },
    });
  }, [selectedFriday, weekStart, weekEnd, summaryByWorker, weeklyTotal]);

  return { generatePDF };
}
