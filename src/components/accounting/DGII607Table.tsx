import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getTipoId, formatDateDGII, TIPO_INGRESO } from "./dgiiConstants";
import ExcelJS from "exceljs";

interface Transaction {
  id: string;
  rnc: string | null;
  document: string | null;
  transaction_date: string;
  amount: number;
  itbis: number | null;
  itbis_retenido: number | null;
  isr_retenido: number | null;
  dgii_tipo_ingreso: string | null;
  name: string | null;
}

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
}

export function DGII607Table({ transactions, month, year }: Props) {
  const rows = transactions.map((tx) => ({
    rnc: tx.rnc?.replace(/[-\s]/g, "") || "",
    tipoId: getTipoId(tx.rnc),
    ncf: tx.document || "",
    fecha: formatDateDGII(tx.transaction_date),
    tipoIngreso: tx.dgii_tipo_ingreso || "",
    montoFacturado: tx.amount?.toFixed(2) || "0.00",
    itbisFacturado: tx.itbis?.toFixed(2) || "0.00",
    itbisRetenido: (tx.itbis_retenido || 0).toFixed(2),
    isrRetenido: (tx.isr_retenido || 0).toFixed(2),
  }));

  const handleCopy = () => {
    const header = "RNC/Cédula\tTipo Id\tNCF\tFecha Comprobante\tTipo de Ingreso\tMonto Facturado\tITBIS Facturado\tITBIS Retenido por Terceros\tISR Retenido por Terceros";
    const lines = rows.map((r) =>
      `${r.rnc}\t${r.tipoId}\t${r.ncf}\t${r.fecha}\t${r.tipoIngreso}\t${r.montoFacturado}\t${r.itbisFacturado}\t${r.itbisRetenido}\t${r.isrRetenido}`
    );
    navigator.clipboard.writeText([header, ...lines].join("\n"));
    toast.success("Datos copiados al portapapeles");
  };

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("607");
    ws.columns = [
      { header: "RNC/Cédula del Comprador", key: "rnc", width: 15 },
      { header: "Tipo Id", key: "tipoId", width: 8 },
      { header: "NCF", key: "ncf", width: 20 },
      { header: "Fecha Comprobante", key: "fecha", width: 12 },
      { header: "Tipo de Ingreso", key: "tipoIngreso", width: 10 },
      { header: "Monto Facturado", key: "montoFacturado", width: 15 },
      { header: "ITBIS Facturado", key: "itbisFacturado", width: 15 },
      { header: "ITBIS Retenido por Terceros", key: "itbisRetenido", width: 15 },
      { header: "ISR Retenido por Terceros", key: "isrRetenido", width: 15 },
    ];
    rows.forEach((r) => ws.addRow(r));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `607-${year}${String(month).padStart(2, "0")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel 607 exportado");
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
              <TableHead>RNC/Cédula</TableHead>
              <TableHead>Tipo Id</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo Ingreso</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">ITBIS Fact.</TableHead>
              <TableHead className="text-right">ITBIS Ret.</TableHead>
              <TableHead className="text-right">ISR Ret.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No hay ventas para este período
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.rnc}</TableCell>
                  <TableCell>{r.tipoId}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fecha}</TableCell>
                  <TableCell title={TIPO_INGRESO[r.tipoIngreso] || ""}>{r.tipoIngreso}</TableCell>
                  <TableCell className="text-right">{r.montoFacturado}</TableCell>
                  <TableCell className="text-right">{r.itbisFacturado}</TableCell>
                  <TableCell className="text-right">{r.itbisRetenido}</TableCell>
                  <TableCell className="text-right">{r.isrRetenido}</TableCell>
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
