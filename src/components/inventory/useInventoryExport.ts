import { useCallback } from "react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { toast } from "sonner";
import { InventoryItem, PurchaseAggregation } from "./types";
import { functionLabels } from "./constants";

interface UseInventoryExportParams {
  items: InventoryItem[];
  purchasesByItem: Record<string, PurchaseAggregation>;
  usageByItem: Record<string, number>;
  isVisible: (key: string) => boolean;
  startDate: Date;
  endDate: Date;
}

export function useInventoryExport({
  items,
  purchasesByItem,
  usageByItem,
  isVisible,
  startDate,
  endDate,
}: UseInventoryExportParams) {
  
  const buildExportRow = useCallback((item: InventoryItem) => {
    const itemPurchases = purchasesByItem[item.id];
    const row: Record<string, string | number> = {};

    if (isVisible("commercial_name")) row["Commercial Name"] = item.commercial_name;
    if (isVisible("molecule_name")) row["Molecule Name"] = item.molecule_name || "-";
    if (isVisible("function")) row["Function"] = functionLabels[item.function] || item.function;
    if (isVisible("stock")) row["Stock"] = `${Number(item.current_quantity).toFixed(2)} ${item.use_unit}`;
    if (isVisible("amount_purchased")) {
      row["Amount Purchased"] = itemPurchases
        ? `${itemPurchases.totalPurchased.toFixed(2)} ${item.use_unit}`
        : "-";
    }
    if (isVisible("amount_used")) {
      row["Amount Used"] = usageByItem[item.id]
        ? `${usageByItem[item.id].toFixed(2)} ${item.use_unit}`
        : "-";
    }
    if (isVisible("suppliers")) {
      row["Suppliers"] =
        itemPurchases && itemPurchases.suppliers.size > 0
          ? Array.from(itemPurchases.suppliers).join(", ")
          : "-";
    }
    if (isVisible("documents")) {
      row["Documents"] =
        itemPurchases && itemPurchases.documents.size > 0
          ? Array.from(itemPurchases.documents).join(", ")
          : "-";
    }
    if (isVisible("co2_equivalent")) {
      row["CO₂ Equivalent"] = item.co2_equivalent ? `${item.co2_equivalent} kg` : "-";
    }

    return row;
  }, [purchasesByItem, usageByItem, isVisible]);

  const exportToExcel = useCallback(async () => {
    if (!items || items.length === 0) {
      toast.error("No items to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Inventory");

      // Get visible columns for headers
      const visibleColumns = [
        { key: "commercial_name", header: "Commercial Name" },
        { key: "molecule_name", header: "Molecule Name" },
        { key: "function", header: "Function" },
        { key: "stock", header: "Stock" },
        { key: "amount_purchased", header: "Amount Purchased" },
        { key: "amount_used", header: "Amount Used" },
        { key: "suppliers", header: "Suppliers" },
        { key: "documents", header: "Documents" },
        { key: "co2_equivalent", header: "CO₂ Equivalent" },
      ].filter(col => isVisible(col.key));

      // Define columns
      worksheet.columns = visibleColumns.map((col) => ({
        header: col.header,
        key: col.header,
        width: 20,
      }));

      // Add data rows
      items.forEach((item) => {
        const row = buildExportRow(item);
        worksheet.addRow(row);
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventory_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Excel export successful");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel");
    }
  }, [items, isVisible, buildExportRow, startDate, endDate]);

  const exportToPDF = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error("No items to export");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });

    // Title
    doc.setFontSize(18);
    doc.text("Inventory Report", 14, 22);
    doc.setFontSize(10);
    doc.text(
      `Date Range: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`,
      14,
      30
    );
    doc.text(`Total Items: ${items.length}`, 14, 36);

    // Get visible columns - use rowKey for data lookup, header for display
    const visibleColumns = [
      { key: "commercial_name", rowKey: "Commercial Name", header: "Commercial Name" },
      { key: "molecule_name", rowKey: "Molecule Name", header: "Molecule" },
      { key: "function", rowKey: "Function", header: "Function" },
      { key: "stock", rowKey: "Stock", header: "Stock" },
      { key: "amount_purchased", rowKey: "Amount Purchased", header: "Purchased" },
      { key: "amount_used", rowKey: "Amount Used", header: "Used" },
      { key: "suppliers", rowKey: "Suppliers", header: "Suppliers" },
      { key: "documents", rowKey: "Documents", header: "Documents" },
      { key: "co2_equivalent", rowKey: "CO₂ Equivalent", header: "CO₂ eq." },
    ].filter(col => isVisible(col.key));

    const headers = visibleColumns.map((col) => col.header);

    // Build table data - use rowKey to lookup values from buildExportRow
    const tableData = items.map((item) => {
      const row = buildExportRow(item);
      return visibleColumns.map((col) => String(row[col.rowKey] || "-"));
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 42,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(
      `inventory_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.pdf`
    );
    toast.success("PDF export successful");
  }, [items, isVisible, buildExportRow, startDate, endDate]);

  return { exportToExcel, exportToPDF };
}
