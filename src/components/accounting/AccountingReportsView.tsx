import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FileBarChart, Download, FileSpreadsheet, FileText, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Filters = {
  startDate: string;
  endDate: string;
  costCenter: string;
  accountCode: string;
  projectCode: string;
  cbsCode: string;
  supplierName: string;
};

const emptyFilters: Filters = {
  startDate: "",
  endDate: "",
  costCenter: "all",
  accountCode: "all",
  projectCode: "all",
  cbsCode: "all",
  supplierName: "",
};

type SortKey = "transaction_date" | "master_acct_code" | "project_code" | "cbs_code" | "cost_center" | "name" | "description" | "currency" | "amount" | "itbis";
type SortDir = "asc" | "desc" | null;

const COST_CENTER_LABELS: Record<string, string> = {
  general: "General",
  agricultural: "Agrícola",
  industrial: "Industrial",
};

export function AccountingReportsView() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeFilters, setActiveFilters] = useState<Filters | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Fetch dropdown options
  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-report-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("account_code, account_name")
        .is("deleted_at", null)
        .eq("allow_posting", true)
        .order("account_code");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["project-codes-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("code, spanish_description")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: cbsCodes = [] } = useQuery({
    queryKey: ["cbs-codes-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cbs_codes")
        .select("code, spanish_description")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch transactions only when filters are applied
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["accounting-report", activeFilters],
    queryFn: async () => {
      if (!activeFilters) return [];
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("is_void", false)
        .order("transaction_date", { ascending: false });

      if (activeFilters.startDate) query = query.gte("transaction_date", activeFilters.startDate);
      if (activeFilters.endDate) query = query.lte("transaction_date", activeFilters.endDate);
      if (activeFilters.accountCode !== "all") query = query.eq("master_acct_code", activeFilters.accountCode);
      if (activeFilters.projectCode !== "all") query = query.eq("project_code", activeFilters.projectCode);
      if (activeFilters.cbsCode !== "all") query = query.eq("cbs_code", activeFilters.cbsCode);
      if (activeFilters.supplierName) query = query.ilike("name", `%${activeFilters.supplierName}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!activeFilters,
  });

  // Client-side cost center filter
  const transactions = useMemo(() => {
    if (!activeFilters || activeFilters.costCenter === "all") return rawData;
    return rawData.filter((tx: any) => (tx.cost_center || "general") === activeFilters.costCenter);
  }, [rawData, activeFilters]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return transactions;
    return [...transactions].sort((a: any, b: any) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (sortKey === "amount" || sortKey === "itbis") {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }
      if (sortKey === "cost_center") {
        av = av || "general";
        bv = bv || "general";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir(null); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    if (sortDir === "asc") return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Totals
  const totalsByCurrency = useMemo(() => {
    return sorted.reduce((acc: Record<string, number>, tx: any) => {
      acc[tx.currency] = (acc[tx.currency] || 0) + (parseFloat(tx.amount) || 0);
      return acc;
    }, {});
  }, [sorted]);

  const applyFilters = () => {
    setActiveFilters({ ...filters });
    setFiltersOpen(false);
  };

  const formatExcelDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()}`;
  };

  const activeFilterLabels = useMemo(() => {
    if (!activeFilters) return [];
    const parts: string[] = [];
    if (activeFilters.startDate) parts.push(`Desde: ${formatExcelDate(activeFilters.startDate)}`);
    if (activeFilters.endDate) parts.push(`Hasta: ${formatExcelDate(activeFilters.endDate)}`);
    if (activeFilters.costCenter !== "all") parts.push(`Centro: ${COST_CENTER_LABELS[activeFilters.costCenter] || activeFilters.costCenter}`);
    if (activeFilters.accountCode !== "all") parts.push(`Cuenta: ${activeFilters.accountCode}`);
    if (activeFilters.projectCode !== "all") parts.push(`Proyecto: ${activeFilters.projectCode}`);
    if (activeFilters.cbsCode !== "all") parts.push(`CBS: ${activeFilters.cbsCode}`);
    if (activeFilters.supplierName) parts.push(`Proveedor: ${activeFilters.supplierName}`);
    return parts;
  }, [activeFilters]);

  const exportToExcel = async () => {
    if (sorted.length === 0) { toast.error("No hay datos para exportar"); return; }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Informe Contable");
      ws.columns = [
        { header: "Fecha", key: "date", width: 14 },
        { header: "Cuenta", key: "account", width: 14 },
        { header: "Proyecto", key: "project", width: 12 },
        { header: "CBS", key: "cbs", width: 12 },
        { header: "Centro Costo", key: "cc", width: 14 },
        { header: "Nombre", key: "name", width: 22 },
        { header: "Descripción", key: "desc", width: 30 },
        { header: "Moneda", key: "currency", width: 10 },
        { header: "Monto", key: "amount", width: 14 },
        { header: "ITBIS", key: "itbis", width: 12 },
      ];
      sorted.forEach((tx: any) => {
        ws.addRow({
          date: formatExcelDate(tx.transaction_date),
          account: tx.master_acct_code || "-",
          project: tx.project_code || "-",
          cbs: tx.cbs_code || "-",
          cc: COST_CENTER_LABELS[tx.cost_center || "general"] || "General",
          name: tx.name || "-",
          desc: tx.description || "-",
          currency: tx.currency,
          amount: parseFloat(tx.amount) || 0,
          itbis: tx.itbis ? parseFloat(tx.itbis) : "",
        });
      });
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ds = [activeFilters?.startDate, activeFilters?.endDate].filter(Boolean).join("_to_");
      a.download = `informe_contable_${ds || format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exportado exitosamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar Excel");
    }
  };

  const exportToPDF = () => {
    if (sorted.length === 0) { toast.error("No hay datos para exportar"); return; }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.text("Informe Contable", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 30);
    let y = 36;
    if (activeFilterLabels.length) {
      doc.text(`Filtros: ${activeFilterLabels.join(" | ")}`, 14, y);
      y += 6;
    }
    doc.text(`Total Transacciones: ${sorted.length}`, 14, y);
    y += 6;
    Object.entries(totalsByCurrency).forEach(([cur, total]) => {
      doc.text(`Total ${cur}: ${formatCurrency(total as number, cur)}`, 14, y);
      y += 6;
    });

    const headers = ["Fecha", "Cuenta", "Proyecto", "CBS", "Centro", "Nombre", "Descripción", "Moneda", "Monto", "ITBIS"];
    const body = sorted.map((tx: any) => [
      formatExcelDate(tx.transaction_date),
      tx.master_acct_code || "-",
      tx.project_code || "-",
      tx.cbs_code || "-",
      COST_CENTER_LABELS[tx.cost_center || "general"] || "General",
      tx.name || "-",
      tx.description || "-",
      tx.currency,
      formatCurrency(parseFloat(tx.amount) || 0, tx.currency),
      tx.itbis ? formatCurrency(parseFloat(tx.itbis), tx.currency) : "-",
    ]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: y + 4,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    const ds = [activeFilters?.startDate, activeFilters?.endDate].filter(Boolean).join("_to_");
    doc.save(`informe_contable_${ds || format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exportado exitosamente");
  };

  return (
    <div className="space-y-4">
      {!activeFilters ? (
        <EmptyState
          icon={FileBarChart}
          title="Informes Contables"
          description="Configure los filtros para generar un informe de transacciones."
          action={
            <Button onClick={() => { setFilters(emptyFilters); setFiltersOpen(true); }}>
              <Filter className="h-4 w-4 mr-1" />
              Generar Informe
            </Button>
          }
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setFilters(activeFilters); setFiltersOpen(true); }}>
                <Filter className="h-4 w-4 mr-1" />
                Modificar Filtros
              </Button>
              {activeFilterLabels.map((l, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{l}</Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {sorted.length} transacciones
                {Object.entries(totalsByCurrency).map(([c, t]) => ` | ${c}: ${formatCurrency(t as number, c)}`).join("")}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Results Table */}
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No se encontraron transacciones con los filtros seleccionados.</div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {([
                      ["transaction_date", "Fecha"],
                      ["master_acct_code", "Cuenta"],
                      ["project_code", "Proyecto"],
                      ["cbs_code", "CBS"],
                      ["cost_center", "Centro"],
                      ["name", "Nombre"],
                      ["description", "Descripción"],
                      ["currency", "Moneda"],
                      ["amount", "Monto"],
                      ["itbis", "ITBIS"],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <TableHead key={key} className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(key)}>
                        <span className="inline-flex items-center">{label}<SortIcon col={key} /></span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell>{tx.master_acct_code || "-"}</TableCell>
                      <TableCell>{tx.project_code || "-"}</TableCell>
                      <TableCell>{tx.cbs_code || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          (tx.cost_center || "general") === "agricultural" ? "bg-green-100 text-green-800 border-green-200" :
                          (tx.cost_center || "general") === "industrial" ? "bg-blue-100 text-blue-800 border-blue-200" :
                          "bg-muted text-muted-foreground"
                        }>
                          {COST_CENTER_LABELS[tx.cost_center || "general"] || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate max-w-[150px]">{tx.name || "-"}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{tx.description || "-"}</TableCell>
                      <TableCell>{tx.currency}</TableCell>
                      <TableCell className="text-right">{formatCurrency(parseFloat(tx.amount) || 0, tx.currency)}</TableCell>
                      <TableCell className="text-right">{tx.itbis ? formatCurrency(parseFloat(tx.itbis), tx.currency) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Filter Dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Informe Contable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fecha Inicio</Label>
                <Input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fecha Fin</Label>
                <Input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {/* 4-col grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Centro de Costo</Label>
                <Select value={filters.costCenter} onValueChange={v => setFilters(f => ({ ...f, costCenter: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="agricultural">Agrícola</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cuenta</Label>
                <Select value={filters.accountCode} onValueChange={v => setFilters(f => ({ ...f, accountCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">Todas</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.account_code} value={a.account_code}>
                        {a.account_code} – {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Proyecto</Label>
                <Select value={filters.projectCode} onValueChange={v => setFilters(f => ({ ...f, projectCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">Todos</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} – {p.spanish_description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CBS</Label>
                <Select value={filters.cbsCode} onValueChange={v => setFilters(f => ({ ...f, cbsCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">Todos</SelectItem>
                    {cbsCodes.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} – {c.spanish_description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supplier */}
            <div className="space-y-1">
              <Label>Proveedor / Nombre</Label>
              <Input
                value={filters.supplierName}
                onChange={e => setFilters(f => ({ ...f, supplierName: e.target.value }))}
                placeholder="Buscar por nombre..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFiltersOpen(false)}>Cancelar</Button>
            <Button onClick={applyFilters}>
              <FileBarChart className="h-4 w-4 mr-1" />
              Ver Informe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
