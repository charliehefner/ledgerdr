import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDateDGII, TIPO_ANULACION } from "./dgiiConstants";
import ExcelJS from "exceljs";

interface Transaction {
  id: string;
  document: string | null;
  transaction_date: string;
  dgii_tipo_anulacion: string | null;
}

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
}

export function DGII608Table({ transactions, month, year }: Props) {
  const rows = transactions.map((tx) => ({
    ncf: tx.document || "",
    fecha: formatDateDGII(tx.transaction_date),
    tipoAnulacion: tx.dgii_tipo_anulacion || "",
  }));

  const handleCopy = () => {
    const header = "NCF\tFecha Comprobante\tTipo de Anulación";
    const lines = rows.map((r) => `${r.ncf}\t${r.fecha}\t${r.tipoAnulacion}`);
    navigator.clipboard.writeText([header, ...lines].join("\n"));
    toast.success("Datos copiados al portapapeles");
  };

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("608");
    ws.columns = [
      { header: "NCF", key: "ncf", width: 20 },
      { header: "Fecha Comprobante", key: "fecha", width: 12 },
      { header: "Tipo de Anulación", key: "tipoAnulacion", width: 10 },
    ];
    rows.forEach((r) => ws.addRow(r));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `608-${year}${String(month).padStart(2, "0")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel 608 exportado");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-1" /> Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Excel
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NCF</TableHead>
              <TableHead>Fecha Comprobante</TableHead>
              <TableHead>Tipo de Anulación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No hay comprobantes anulados para este período
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fecha}</TableCell>
                  <TableCell title={TIPO_ANULACION[r.tipoAnulacion] || ""}>{r.tipoAnulacion}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground">
        Total registros: {rows.length}
      </div>
    </div>
  );
}
