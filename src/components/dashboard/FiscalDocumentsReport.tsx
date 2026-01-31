import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Download, Calendar, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";
import { toast } from "sonner";

interface FiscalTransaction {
  id: string;
  transaction_date: string;
  currency: string;
  amount: number;
  itbis: number | null;
  pay_method: string | null;
  document: string;
  name: string | null;
  rnc: string | null;
}

type SortKey = "transaction_date" | "currency" | "amount" | "itbis" | "pay_method" | "document" | "name" | "rnc";
type SortDirection = "asc" | "desc" | null;

export function FiscalDocumentsReport() {
  const [isOpen, setIsOpen] = useState(false);
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(today));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(today));
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const { data: fiscalTransactions = [], isLoading } = useQuery({
    queryKey: ["fiscal-documents", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, currency, amount, itbis, pay_method, document, name, rnc")
        .eq("is_void", false)
        .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
        .lte("transaction_date", format(endDate, "yyyy-MM-dd"))
        .or("document.ilike.E31%,document.ilike.B01%")
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data as FiscalTransaction[];
    },
    enabled: isOpen,
  });

  // Sorting logic
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedTransactions = useMemo(() => {
    if (!sortKey || !sortDirection) return fiscalTransactions;

    return [...fiscalTransactions].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Handle nulls
      if (aVal === null) aVal = "";
      if (bVal === null) bVal = "";

      // Numeric comparison for amount and itbis
      if (sortKey === "amount" || sortKey === "itbis") {
        const aNum = typeof aVal === "number" ? aVal : 0;
        const bNum = typeof bVal === "number" ? bVal : 0;
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      // String comparison for others
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [fiscalTransactions, sortKey, sortDirection]);

  // Calculate totals
  const totals = fiscalTransactions.reduce(
    (acc, tx) => {
      if (tx.currency === "DOP") {
        acc.dopAmount += tx.amount;
        acc.dopItbis += tx.itbis || 0;
      } else {
        acc.usdAmount += tx.amount;
        acc.usdItbis += tx.itbis || 0;
      }
      return acc;
    },
    { dopAmount: 0, dopItbis: 0, usdAmount: 0, usdItbis: 0 }
  );

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="ml-1 h-3 w-3" />;
    }
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const handleExport = async () => {
    if (fiscalTransactions.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Comprobantes Fiscales");

    // Header
    worksheet.addRow([
      `Comprobantes Fiscales (E31/B01) - ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`
    ]);
    worksheet.mergeCells("A1:H1");
    worksheet.getRow(1).font = { bold: true, size: 14 };
    worksheet.addRow([]);

    // Column headers
    worksheet.addRow(["Fecha", "Moneda", "Monto", "ITBIS", "Método Pago", "Documento", "Nombre", "RNC"]);
    worksheet.getRow(3).font = { bold: true };
    worksheet.getRow(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };

    // Data rows
    fiscalTransactions.forEach((tx) => {
      worksheet.addRow([
        format(new Date(tx.transaction_date), "dd/MM/yyyy"),
        tx.currency,
        tx.amount,
        tx.itbis || 0,
        tx.pay_method || "-",
        tx.document,
        tx.name || "-",
        tx.rnc || "-",
      ]);
    });

    // Totals
    const lastRow = worksheet.rowCount + 2;
    worksheet.addRow([]);
    worksheet.addRow(["TOTALES DOP", "DOP", totals.dopAmount, totals.dopItbis, "", "", "", ""]);
    worksheet.addRow(["TOTALES USD", "USD", totals.usdAmount, totals.usdItbis, "", "", "", ""]);

    // Format numbers
    worksheet.getColumn(3).numFmt = "#,##0.00";
    worksheet.getColumn(4).numFmt = "#,##0.00";

    // Auto-fit columns
    worksheet.columns.forEach((col) => {
      col.width = 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprobantes_fiscales_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte exportado exitosamente");
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-blue-200 dark:border-blue-800 w-fit">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
                    Comprobantes Fiscales (E31/B01)
                  </CardTitle>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Facturas con crédito fiscal
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-blue-700 dark:text-blue-300">
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-accent-foreground">Desde:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal bg-card">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(startDate, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-accent-foreground">Hasta:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal bg-card">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(endDate, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                variant="outline"
                onClick={handleExport}
                disabled={fiscalTransactions.length === 0}
                className="ml-auto bg-card"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-card rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Transacciones</p>
                <p className="text-xl font-bold">{fiscalTransactions.length}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Total DOP</p>
                <p className="text-xl font-bold">{formatCurrency(totals.dopAmount, "DOP")}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">ITBIS DOP</p>
                <p className="text-xl font-bold">{formatCurrency(totals.dopItbis, "DOP")}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Total USD</p>
                <p className="text-xl font-bold">{formatCurrency(totals.usdAmount, "USD")}</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("transaction_date")}
                    >
                      <div className="flex items-center">Fecha<SortIcon columnKey="transaction_date" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("currency")}
                    >
                      <div className="flex items-center">Moneda<SortIcon columnKey="currency" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none text-right"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center justify-end">Monto<SortIcon columnKey="amount" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none text-right"
                      onClick={() => handleSort("itbis")}
                    >
                      <div className="flex items-center justify-end">ITBIS<SortIcon columnKey="itbis" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("pay_method")}
                    >
                      <div className="flex items-center">Método<SortIcon columnKey="pay_method" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("document")}
                    >
                      <div className="flex items-center">Documento<SortIcon columnKey="document" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">Nombre<SortIcon columnKey="name" /></div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("rnc")}
                    >
                      <div className="flex items-center">RNC<SortIcon columnKey="rnc" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : sortedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay comprobantes fiscales en este período
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                        <TableCell>{tx.currency}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>
                        <TableCell className="text-right">{tx.itbis ? formatCurrency(tx.itbis, tx.currency) : "-"}</TableCell>
                        <TableCell>{tx.pay_method || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{tx.document}</TableCell>
                        <TableCell className="truncate max-w-[150px]">{tx.name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{tx.rnc || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
