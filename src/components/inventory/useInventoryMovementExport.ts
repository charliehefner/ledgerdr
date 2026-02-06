import { useCallback } from "react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { toast } from "sonner";
import { functionLabels } from "./constants";

interface ReportRow {
  id: string;
  commercial_name: string;
  molecule_name: string | null;
  function: string;
  use_unit: string;
  stock: number;
  purchaseUnits: number;
  purchaseValue: number;
  useUnits: number;
  useValue: number;
  co2e: number;
}

interface Totals {
  purchaseValue: number;
  useValue: number;
  co2e: number;
}

interface UseInventoryMovementExportParams {
  reportData: ReportRow[];
  totals: Totals;
  startDate: Date;
  endDate: Date;
}

export function useInventoryMovementExport({
  reportData,
  totals,
  startDate,
  endDate,
}: UseInventoryMovementExportParams) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 2) => {
    return value.toFixed(decimals);
  };

  const exportToExcel = useCallback(async () => {
    if (reportData.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Inventory Movement");

      // Title row
      sheet.mergeCells("A1:I1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = "Inventory Movement Report";
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center" };

      // Date range row
      sheet.mergeCells("A2:I2");
      const dateCell = sheet.getCell("A2");
      dateCell.value = `Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`;
      dateCell.font = { size: 11 };
      dateCell.alignment = { horizontal: "center" };

      // Empty row
      sheet.addRow([]);

      // Define columns
      sheet.columns = [
        { key: "commercial_name", header: "Nombre Comercial", width: 25 },
        { key: "molecule_name", header: "Molécula", width: 20 },
        { key: "function", header: "Función", width: 18 },
        { key: "stock", header: "Stock", width: 15 },
        { key: "purchaseUnits", header: "Compra (Unidades)", width: 18 },
        { key: "purchaseValue", header: "Compra (Valor)", width: 18 },
        { key: "useUnits", header: "Uso (Unidades)", width: 18 },
        { key: "useValue", header: "Uso (Valor)", width: 18 },
        { key: "co2e", header: "CO₂-e (kg)", width: 15 },
      ];

      // Header row (row 4)
      const headerRow = sheet.getRow(4);
      headerRow.values = [
        "Nombre Comercial",
        "Molécula",
        "Función",
        "Stock",
        "Compra (Unidades)",
        "Compra (Valor)",
        "Uso (Unidades)",
        "Uso (Valor)",
        "CO₂-e (kg)",
      ];
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      headerRow.alignment = { horizontal: "center" };

      // Data rows
      reportData.forEach((row) => {
        sheet.addRow({
          commercial_name: row.commercial_name,
          molecule_name: row.molecule_name || "-",
          function: functionLabels[row.function] || row.function,
          stock: `${formatNumber(row.stock)} ${row.use_unit}`,
          purchaseUnits: row.purchaseUnits > 0 ? `${formatNumber(row.purchaseUnits)} ${row.use_unit}` : "-",
          purchaseValue: row.purchaseValue > 0 ? formatCurrency(row.purchaseValue) : "-",
          useUnits: row.useUnits > 0 ? `${formatNumber(row.useUnits)} ${row.use_unit}` : "-",
          useValue: row.useValue > 0 ? formatCurrency(row.useValue) : "-",
          co2e: row.co2e > 0 ? formatNumber(row.co2e) : "-",
        });
      });

      // Totals row
      const totalsRowIdx = sheet.addRow({
        commercial_name: "",
        molecule_name: "",
        function: "",
        stock: "",
        purchaseUnits: "TOTALES:",
        purchaseValue: formatCurrency(totals.purchaseValue),
        useUnits: "",
        useValue: formatCurrency(totals.useValue),
        co2e: formatNumber(totals.co2e),
      }).number;

      const totalsRow = sheet.getRow(totalsRowIdx);
      totalsRow.font = { bold: true };
      totalsRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventory_movement_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Excel exportado exitosamente");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Error al exportar Excel");
    }
  }, [reportData, totals, startDate, endDate]);

  const exportToPDF = useCallback(() => {
    if (reportData.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter",
      });

      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Inventory Movement Report", 14, 15);

      // Date range
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`,
        14,
        22
      );
      pdf.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 27);

      // Headers
      const headers = [
        "Nombre Comercial",
        "Molécula",
        "Función",
        "Stock",
        "Compra (U)",
        "Compra ($)",
        "Uso (U)",
        "Uso ($)",
        "CO₂-e",
      ];

      // Build table data
      const tableData = reportData.map((row) => [
        row.commercial_name,
        row.molecule_name || "-",
        functionLabels[row.function] || row.function,
        `${formatNumber(row.stock)} ${row.use_unit}`,
        row.purchaseUnits > 0 ? formatNumber(row.purchaseUnits) : "-",
        row.purchaseValue > 0 ? formatCurrency(row.purchaseValue) : "-",
        row.useUnits > 0 ? formatNumber(row.useUnits) : "-",
        row.useValue > 0 ? formatCurrency(row.useValue) : "-",
        row.co2e > 0 ? formatNumber(row.co2e) : "-",
      ]);

      // Add totals row
      tableData.push([
        "",
        "",
        "",
        "",
        "TOTALES:",
        formatCurrency(totals.purchaseValue),
        "",
        formatCurrency(totals.useValue),
        formatNumber(totals.co2e),
      ]);

      // Generate table
      autoTable(pdf, {
        head: [headers],
        body: tableData,
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 129, 189], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didParseCell: (cellData) => {
          // Style totals row
          if (cellData.row.index === tableData.length - 1) {
            cellData.cell.styles.fontStyle = "bold";
            cellData.cell.styles.fillColor = [217, 225, 242];
          }
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 28 },
          6: { cellWidth: 22 },
          7: { cellWidth: 28 },
          8: { cellWidth: 20 },
        },
      });

      // Save PDF
      pdf.save(`inventory_movement_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.pdf`);

      toast.success("PDF exportado exitosamente");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Error al exportar PDF");
    }
  }, [reportData, totals, startDate, endDate]);

  return { exportToExcel, exportToPDF };
}
