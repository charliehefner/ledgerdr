import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import ExcelJS from "exceljs";

interface IT1ReportViewProps {
  purchases: any[];
  sales: any[];
  month: number;
  year: number;
}

export function IT1ReportView({ purchases, sales, month, year }: IT1ReportViewProps) {
  const [saldoAnterior, setSaldoAnterior] = useState(0);

  const calc = useMemo(() => {
    const totalVentasGravadas = sales
      .filter((s) => (s.itbis ?? 0) > 0)
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);

    const itbisCobrado = sales.reduce((sum, s) => sum + Number(s.itbis || 0), 0);

    const totalComprasConItbis = purchases
      .filter((p) => (p.itbis ?? 0) > 0)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const itbisPagado = purchases.reduce((sum, p) => sum + Number(p.itbis || 0), 0);

    const itbisRetenidoTerceros = purchases.reduce(
      (sum, p) => sum + Number(p.itbis_retenido || 0),
      0
    );

    const totalDeducciones = itbisPagado + itbisRetenidoTerceros + saldoAnterior;
    const resultado = itbisCobrado - totalDeducciones;

    return {
      totalVentasGravadas,
      itbisCobrado,
      totalComprasConItbis,
      itbisPagado,
      itbisRetenidoTerceros,
      totalDeducciones,
      resultado,
    };
  }, [purchases, sales, saldoAnterior]);

  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const handleCopy = () => {
    const abs = Math.abs(calc.resultado);
    const label = calc.resultado >= 0 ? "ITBIS a Pagar" : "Saldo a Favor";
    navigator.clipboard.writeText(abs.toFixed(2));
    toast.success(`${label}: ${formatCurrency(abs, "DOP")} copiado`);
  };

  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("IT-1");

    ws.columns = [
      { header: "Concepto", key: "concept", width: 40 },
      { header: "Monto (RD$)", key: "amount", width: 20 },
    ];

    const rows = [
      ["SECCIÓN I: OPERACIONES", ""],
      ["Total Ventas Gravadas", calc.totalVentasGravadas],
      ["ITBIS Cobrado", calc.itbisCobrado],
      ["", ""],
      ["SECCIÓN II: DEDUCCIONES", ""],
      ["Total Compras con ITBIS", calc.totalComprasConItbis],
      ["ITBIS Pagado en Compras", calc.itbisPagado],
      ["ITBIS Retenido por Terceros", calc.itbisRetenidoTerceros],
      ["Saldo a Favor Anterior", saldoAnterior],
      ["Total Deducciones", calc.totalDeducciones],
      ["", ""],
      ["RESULTADO", ""],
      [
        calc.resultado >= 0 ? "ITBIS a Pagar" : "Saldo a Favor",
        Math.abs(calc.resultado),
      ],
    ];

    rows.forEach(([concept, amount]) => {
      const row = ws.addRow({ concept, amount: amount === "" ? "" : amount });
      if (typeof amount === "string" && amount === "") {
        row.font = { bold: true };
      }
      if (typeof amount === "number") {
        row.getCell("amount").numFmt = "#,##0.00";
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IT-1_${MONTHS[month - 1]}_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado");
  };

  const Line = ({
    label,
    value,
    bold,
    highlight,
  }: {
    label: string;
    value: number;
    bold?: boolean;
    highlight?: boolean;
  }) => (
    <div
      className={`flex justify-between py-1 ${bold ? "font-semibold" : ""} ${
        highlight ? "text-lg border-t-2 border-foreground pt-2 mt-2" : ""
      }`}
    >
      <span>{label}</span>
      <span className={highlight && value < 0 ? "text-destructive" : ""}>
        {formatCurrency(Math.abs(value), "DOP")}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          IT-1 — Declaración Mensual de ITBIS · {MONTHS[month - 1]} {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        {/* Section I */}
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground mb-1">
            Sección I: Operaciones
          </h4>
          <Line label="Total Ventas Gravadas" value={calc.totalVentasGravadas} />
          <Line label="ITBIS Cobrado" value={calc.itbisCobrado} bold />
        </div>

        {/* Section II */}
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground mb-1">
            Sección II: Deducciones
          </h4>
          <Line label="Total Compras con ITBIS" value={calc.totalComprasConItbis} />
          <Line label="ITBIS Pagado en Compras" value={calc.itbisPagado} />
          <Line label="ITBIS Retenido por Terceros" value={calc.itbisRetenidoTerceros} />

          <div className="flex justify-between items-center py-1">
            <Label htmlFor="saldo-anterior">Saldo a Favor Anterior</Label>
            <Input
              id="saldo-anterior"
              type="number"
              min={0}
              step="0.01"
              className="w-36 text-right"
              value={saldoAnterior || ""}
              onChange={(e) => setSaldoAnterior(Number(e.target.value) || 0)}
            />
          </div>

          <Line label="Total Deducciones" value={calc.totalDeducciones} bold />
        </div>

        {/* Result */}
        <Line
          label={calc.resultado >= 0 ? "ITBIS a Pagar" : "Saldo a Favor"}
          value={calc.resultado}
          bold
          highlight
        />

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" />
            Copiar Total
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Exportar Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
