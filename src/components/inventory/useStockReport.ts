import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useStockReport() {
  // Fetch active inventory items
  const { data: items, isLoading } = useQuery({
    queryKey: ["inventoryItemsStockReport"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("commercial_name, current_quantity, use_unit")
        .eq("is_active", true)
        .order("commercial_name");

      if (error) throw error;
      return data;
    },
  });

  const exportStockReport = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error("No hay artículos en inventario");
      return;
    }

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Reporte de Inventario", 14, 22);
    doc.setFontSize(10);
    doc.text(`Fecha: ${format(new Date(), "dd/MM/yyyy")}`, 14, 30);
    doc.text(`Total de artículos: ${items.length}`, 14, 36);

    // Build table data
    const tableData = items.map((item) => [
      item.commercial_name,
      `${Number(item.current_quantity).toFixed(2)} ${item.use_unit}`,
    ]);

    autoTable(doc, {
      head: [["Nombre Comercial", "Stock Actual"]],
      body: tableData,
      startY: 42,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 111, 92] },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50, halign: "right" },
      },
    });

    doc.save(`inventario_stock_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Reporte de stock generado");
  }, [items]);

  return { exportStockReport, isLoading };
}
