import { useCallback } from "react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
}

export interface ExportData {
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  totalsRow?: Record<string, string | number>;
}

/**
 * Reusable hook for Excel and PDF exports.
 * Eliminates duplicate export logic across components.
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

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${config.filename}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación Exitosa",
        description: `Se exportaron ${data.rows.length} registros a Excel.`,
      });
    } catch (error) {
      console.error("Excel export error:", error);
      toast({
        title: "Error",
        description: "Error al exportar a Excel.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const exportToPDF = useCallback((
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
      pdf.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, startY);
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
        styles: { fontSize: 8, cellPadding: 2 },
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

      // Save PDF
      pdf.save(`${config.filename}-${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Exportación Exitosa",
        description: `Se exportaron ${data.rows.length} registros a PDF.`,
      });
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
