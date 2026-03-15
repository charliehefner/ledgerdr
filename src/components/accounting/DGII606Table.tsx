import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getTipoId, formatDateDGII, getFormaDePago, TIPO_BIENES_SERVICIOS } from "./dgiiConstants";
import ExcelJS from "exceljs";

interface Transaction {
  id: string;
  rnc: string | null;
  document: string | null;
  transaction_date: string;
  purchase_date: string | null;
  amount: number;
  itbis: number | null;
  itbis_retenido: number | null;
  isr_retenido: number | null;
  pay_method: string | null;
  dgii_tipo_bienes_servicios: string | null;
  name: string | null;
}

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
}

export function DGII606Table({ transactions, month, year }: Props) {
  const rows = transactions.map((tx) => ({
    rnc: tx.rnc?.replace(/[-\s]/g, "") || "",
    tipoId: getTipoId(tx.rnc),
    tipoBienes: tx.dgii_tipo_bienes_servicios || "",
    ncf: tx.document || "",
    ncfModificado: "",
    fecha: formatDateDGII(tx.transaction_date),
    fechaPago: formatDateDGII(tx.purchase_date || tx.transaction_date),
    montoFacturado: ((tx.amount || 0) - (tx.itbis || 0)).toFixed(2),
    itbisFacturado: tx.itbis?.toFixed(2) || "0.00",
    itbisRetenido: (tx.itbis_retenido || 0).toFixed(2),
    isrRetenido: (tx.isr_retenido || 0).toFixed(2),
    formaPago: getFormaDePago(tx.pay_method),
  }));

  const handleCopy = () => {
    const header = "RNC/Cédula\tTipo Id\tTipo Bienes y Servicios\tNCF\tNCF Modificado\tFecha Comprobante\tFecha de Pago\tMonto Facturado\tITBIS Facturado\tITBIS Retenido\tISR Retenido\tForma de Pago";
    const lines = rows.map((r) =>
      `${r.rnc}\t${r.tipoId}\t${r.tipoBienes}\t${r.ncf}\t${r.ncfModificado}\t${r.fecha}\t${r.fechaPago}\t${r.montoFacturado}\t${r.itbisFacturado}\t${r.itbisRetenido}\t${r.isrRetenido}\t${r.formaPago}`
    );
    navigator.clipboard.writeText([header, ...lines].join("\n"));
    toast.success("Datos copiados al portapapeles");
  };

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("606");
    ws.columns = [
      { header: "RNC/Cédula", key: "rnc", width: 15 },
      { header: "Tipo Id", key: "tipoId", width: 8 },
      { header: "Tipo Bienes y Servicios", key: "tipoBienes", width: 10 },
      { header: "NCF", key: "ncf", width: 20 },
      { header: "NCF o Documento Modificado", key: "ncfModificado", width: 20 },
      { header: "Fecha Comprobante", key: "fecha", width: 12 },
      { header: "Fecha de Pago", key: "fechaPago", width: 12 },
      { header: "Monto Facturado", key: "montoFacturado", width: 15 },
      { header: "ITBIS Facturado", key: "itbisFacturado", width: 15 },
      { header: "ITBIS Retenido", key: "itbisRetenido", width: 15 },
      { header: "ISR Retenido", key: "isrRetenido", width: 15 },
      { header: "Forma de Pago", key: "formaPago", width: 12 },
    ];
    rows.forEach((r) => ws.addRow(r));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `606-${year}${String(month).padStart(2, "0")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel 606 exportado");
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
              <TableHead>Tipo B/S</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>NCF Mod.</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>F. Pago</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">ITBIS Fact.</TableHead>
              <TableHead className="text-right">ITBIS Ret.</TableHead>
              <TableHead className="text-right">ISR Ret.</TableHead>
              <TableHead>Forma Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  No hay compras para este período
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.rnc}</TableCell>
                  <TableCell>{r.tipoId}</TableCell>
                  <TableCell title={TIPO_BIENES_SERVICIOS[r.tipoBienes] || ""}>{r.tipoBienes}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ncfModificado}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fecha}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fechaPago}</TableCell>
                  <TableCell className="text-right">{r.montoFacturado}</TableCell>
                  <TableCell className="text-right">{r.itbisFacturado}</TableCell>
                  <TableCell className="text-right">{r.itbisRetenido}</TableCell>
                  <TableCell className="text-right">{r.isrRetenido}</TableCell>
                  <TableCell>{r.formaPago}</TableCell>
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
