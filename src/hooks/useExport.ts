import { useCallback } from "react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import { fmtDate } from "@/lib/dateUtils";

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

export interface ExportConfig {
  filename: string;
  title: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  fontSize?: number;
}

export interface ExportData {
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  totalsRow?: Record<string, string | number>;
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
      // User cancelled the dialog or other error
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

/**
 * Reusable hook for Excel and PDF exports.
 * Uses File System Access API when available for save dialog.
 */
export function useExport() {
  const { toast } = useToast();

  const exportToExcel = useCallback(async (
    data: ExportData,
    config: ExportConfig
  ) => {
    if (data.rows.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay datos para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(config.title);

      // Define columns
      sheet.columns = data.columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
      }));

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Add data rows
      data.rows.forEach(row => {
        sheet.addRow(row);
      });

      // Add totals row if provided
      if (data.totalsRow) {
        const lastRowIdx = sheet.addRow(data.totalsRow).number;
        sheet.getRow(lastRowIdx).font = { bold: true };
        sheet.getRow(lastRowIdx).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9E1F2" },
        };
      }

      // Generate blob
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      
      const filename = `${config.filename}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      
      // Use save picker or fallback
      const saved = await saveFileWithPicker(blob, filename, {
        description: "Excel Workbook",
        accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
      });

      if (saved) {
        toast({
          title: "Exportación Exitosa",
          description: `Se exportaron ${data.rows.length} registros a Excel.`,
        });
      }
    } catch (error) {
      console.error("Excel export error:", error);
      toast({
        title: "Error",
        description: "Error al exportar a Excel.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const exportToPDF = useCallback(async (
    data: ExportData,
    config: ExportConfig
  ) => {
    if (data.rows.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay datos para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: config.orientation || "landscape",
        unit: "mm",
        format: "letter",
      });

      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(config.title, 14, 15);

      // Subtitle
      let startY = 22;
      if (config.subtitle) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(config.subtitle, 14, startY);
        startY += 5;
      }

      // Generated date
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generado: ${fmtDate(new Date())}`, 14, startY);
      startY += 7;

      // Build table data
      const headers = data.columns.map(col => col.header);
      const rows = data.rows.map(row =>
        data.columns.map(col => String(row[col.key] ?? "-"))
      );

      // Add totals row if provided
      if (data.totalsRow) {
        const totalsRowArr = data.columns.map(col =>
          String(data.totalsRow![col.key] ?? "")
        );
        rows.push(totalsRowArr);
      }

      // Generate table
      autoTable(pdf, {
        head: [headers],
        body: rows,
        startY,
        styles: { fontSize: config.fontSize || 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 129, 189], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didParseCell: (cellData) => {
          // Style totals row
          if (data.totalsRow && cellData.row.index === rows.length - 1) {
            cellData.cell.styles.fontStyle = "bold";
            cellData.cell.styles.fillColor = [217, 225, 242];
          }
        },
      });

      // Get PDF as blob
      const pdfBlob = pdf.output("blob");
      const filename = `${config.filename}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      
      // Use save picker or fallback
      const saved = await saveFileWithPicker(pdfBlob, filename, {
        description: "PDF Document",
        accept: { "application/pdf": [".pdf"] },
      });

      if (saved) {
        toast({
          title: "Exportación Exitosa",
          description: `Se exportaron ${data.rows.length} registros a PDF.`,
        });
      }
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Error",
        description: "Error al exportar a PDF.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return { exportToExcel, exportToPDF };
}
