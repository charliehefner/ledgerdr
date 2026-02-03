import { useCallback } from "react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import { Operation } from "./types";
import { useToast } from "@/hooks/use-toast";

interface UseOperationsExportParams {
  filteredOperations: Operation[];
  isVisible: (key: string) => boolean;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export function useOperationsExport({
  filteredOperations,
  isVisible,
  startDate,
  endDate,
}: UseOperationsExportParams) {
  const { toast } = useToast();

  const exportToExcel = useCallback(async () => {
    if (filteredOperations.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bitácora de Operaciones");

    // Define columns based on visible columns
    const columns: { header: string; key: string; width: number }[] = [];
    if (isVisible("date")) columns.push({ header: "Fecha", key: "date", width: 15 });
    if (isVisible("field")) columns.push({ header: "Campo", key: "field", width: 20 });
    if (isVisible("farm")) columns.push({ header: "Finca", key: "farm", width: 20 });
    if (isVisible("operation")) columns.push({ header: "Operación", key: "operation", width: 25 });
    if (isVisible("tractor")) columns.push({ header: "Tractor/Obreros", key: "tractor", width: 20 });
    if (isVisible("driver")) columns.push({ header: "Operador", key: "driver", width: 20 });
    if (isVisible("implement")) columns.push({ header: "Implemento", key: "implement", width: 20 });
    if (isVisible("hours")) columns.push({ header: "Horas", key: "hours", width: 10 });
    if (isVisible("hectares")) columns.push({ header: "Hectáreas", key: "hectares", width: 12 });
    if (isVisible("inputs")) columns.push({ header: "Insumos", key: "inputs", width: 40 });
    if (isVisible("notes")) columns.push({ header: "Notas", key: "notes", width: 30 });

    sheet.columns = columns;

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F81BD" },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Add data rows
    filteredOperations.forEach((op) => {
      const hoursWorked = op.start_hours != null && op.end_hours != null
        ? (op.end_hours - op.start_hours).toFixed(1)
        : "";
      
      const inputsText = op.operation_inputs
        .map(input => `${input.inventory_items.commercial_name}: ${input.quantity_used} ${input.inventory_items.use_unit}`)
        .join(", ");

      const row: Record<string, string | number> = {};
      if (isVisible("date")) row.date = format(parseDateLocal(op.operation_date), "dd/MM/yyyy");
      if (isVisible("field")) row.field = op.fields.name;
      if (isVisible("farm")) row.farm = op.fields.farms.name;
      if (isVisible("operation")) row.operation = op.operation_types.name;
      if (isVisible("tractor")) {
        row.tractor = op.operation_types.is_mechanical 
          ? (op.fuel_equipment?.name || "") 
          : `${op.workers_count || 0} obreros`;
      }
      if (isVisible("driver")) row.driver = op.driver || "";
      if (isVisible("implement")) row.implement = op.implements?.name || "";
      if (isVisible("hours")) row.hours = hoursWorked;
      if (isVisible("hectares")) row.hectares = op.hectares_done;
      if (isVisible("inputs")) row.inputs = inputsText;
      if (isVisible("notes")) row.notes = op.notes || "";

      sheet.addRow(row);
    });

    // Add summary row
    const totalHectares = filteredOperations.reduce((sum, op) => sum + op.hectares_done, 0);
    const totalHours = filteredOperations.reduce((sum, op) => {
      if (op.start_hours != null && op.end_hours != null) {
        return sum + (op.end_hours - op.start_hours);
      }
      return sum;
    }, 0);

    const summaryRow: Record<string, string | number> = {};
    columns.forEach(col => {
      if (col.key === "date") summaryRow.date = "TOTAL";
      else if (col.key === "hours") summaryRow.hours = totalHours.toFixed(1);
      else if (col.key === "hectares") summaryRow.hectares = totalHectares.toFixed(2);
      else summaryRow[col.key] = "";
    });
    const lastRowIdx = sheet.addRow(summaryRow).number;
    sheet.getRow(lastRowIdx).font = { bold: true };
    sheet.getRow(lastRowIdx).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };

    // Generate and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bitacora-operaciones-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportación Exitosa",
      description: `Se exportaron ${filteredOperations.length} operaciones a Excel.`,
    });
  }, [filteredOperations, isVisible, toast]);

  const exportToPDF = useCallback(() => {
    if (filteredOperations.length === 0) return;

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
    
    // Title
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Bitácora de Operaciones", 14, 15);
    
    // Date range subtitle
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const dateRangeText = startDate && endDate 
      ? `Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
      : "Todas las fechas";
    pdf.text(dateRangeText, 14, 22);
    pdf.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 27);

    // Build column headers based on visibility
    const headers: string[] = [];
    if (isVisible("date")) headers.push("Fecha");
    if (isVisible("field")) headers.push("Campo");
    if (isVisible("farm")) headers.push("Finca");
    if (isVisible("operation")) headers.push("Operación");
    if (isVisible("tractor")) headers.push("Tractor/Obreros");
    if (isVisible("driver")) headers.push("Operador");
    if (isVisible("implement")) headers.push("Implemento");
    if (isVisible("hours")) headers.push("Horas");
    if (isVisible("hectares")) headers.push("Ha");
    if (isVisible("inputs")) headers.push("Insumos");
    if (isVisible("notes")) headers.push("Notas");

    // Build data rows
    const rows = filteredOperations.map((op) => {
      const hoursWorked = op.start_hours != null && op.end_hours != null
        ? (op.end_hours - op.start_hours).toFixed(1)
        : "";
      
      const inputsText = op.operation_inputs
        .map(input => `${input.inventory_items.commercial_name}: ${input.quantity_used}`)
        .join("; ");

      const row: string[] = [];
      if (isVisible("date")) row.push(format(parseDateLocal(op.operation_date), "dd/MM/yyyy"));
      if (isVisible("field")) row.push(op.fields.name);
      if (isVisible("farm")) row.push(op.fields.farms.name);
      if (isVisible("operation")) row.push(op.operation_types.name);
      if (isVisible("tractor")) {
        row.push(op.operation_types.is_mechanical 
          ? (op.fuel_equipment?.name || "") 
          : `${op.workers_count || 0} obreros`);
      }
      if (isVisible("driver")) row.push(op.driver || "");
      if (isVisible("implement")) row.push(op.implements?.name || "");
      if (isVisible("hours")) row.push(hoursWorked);
      if (isVisible("hectares")) row.push(op.hectares_done.toString());
      if (isVisible("inputs")) row.push(inputsText);
      if (isVisible("notes")) row.push(op.notes || "");

      return row;
    });

    // Add totals row
    const totalHectares = filteredOperations.reduce((sum, op) => sum + op.hectares_done, 0);
    const totalHours = filteredOperations.reduce((sum, op) => {
      if (op.start_hours != null && op.end_hours != null) {
        return sum + (op.end_hours - op.start_hours);
      }
      return sum;
    }, 0);

    const totalsRow: string[] = [];
    headers.forEach((header) => {
      if (header === "Fecha") totalsRow.push("TOTAL");
      else if (header === "Horas") totalsRow.push(totalHours.toFixed(1));
      else if (header === "Ha") totalsRow.push(totalHectares.toFixed(2));
      else totalsRow.push("");
    });
    rows.push(totalsRow);

    // Generate table
    autoTable(pdf, {
      head: [headers],
      body: rows,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 129, 189], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        // Style the totals row
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [217, 225, 242];
        }
      },
    });

    // Save PDF
    pdf.save(`bitacora-operaciones-${format(new Date(), "yyyy-MM-dd")}.pdf`);

    toast({
      title: "Exportación Exitosa",
      description: `Se exportaron ${filteredOperations.length} operaciones a PDF.`,
    });
  }, [filteredOperations, isVisible, startDate, endDate, toast]);

  return { exportToExcel, exportToPDF };
}
