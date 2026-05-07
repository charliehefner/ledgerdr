import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Copy, Download, FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  getTipoId,
  getFormaDePago,
  TIPO_BIENES_SERVICIOS,
  TIPO_RETENCION_ISR,
  type BankAccountForDGII,
} from "./dgiiConstants";
import ExcelJS from "exceljs";
import { formatMoney } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";

interface BasicTx {
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

interface FullTx extends BasicTx {
  ncf_modificado: string | null;
  monto_bienes: number | null;
  monto_servicios: number | null;
  dgii_tipo_retencion_isr: string | null;
  isc: number | null;
  propina_legal: number | null;
  otros_impuestos: number | null;
  itbis_proporcionalidad: number | null;
  itbis_al_costo: number | null;
  itbis_percibido: number | null;
  isr_percibido: number | null;
  account_id: string | null;
}

interface Props {
  transactions: BasicTx[];
  month: number;
  year: number;
  bankAccounts?: BankAccountForDGII[];
  entityId: string | null;
}

const fmtDateDDMMYYYY = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};
const fmt2 = (n: number | null | undefined) => (Number(n) || 0).toFixed(2);

export function DGII606Table({ transactions, month, year, bankAccounts, entityId }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState<FullTx | null>(null);
  const queryClient = useQueryClient();

  const ids = useMemo(() => transactions.map(t => t.id), [transactions]);

  // Fetch full enrichment columns + COA bs_type for accurate split
  const { data: enriched = [] } = useQuery({
    queryKey: ["dgii606-enriched", month, year, ids.length],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, ncf_modificado, monto_bienes, monto_servicios, dgii_tipo_retencion_isr, isc, propina_legal, otros_impuestos, itbis_proporcionalidad, itbis_al_costo, itbis_percibido, isr_percibido, account_id"
        )
        .in("id", ids);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: ids.length > 0,
  });

  const { data: coaBsMap = {} } = useQuery({
    queryKey: ["coa-bs-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, dgii_bs_type")
        .not("dgii_bs_type", "is", null);
      if (error) throw error;
      const m: Record<string, string> = {};
      (data || []).forEach((r: any) => { m[r.id] = r.dgii_bs_type; });
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });

  const merged: FullTx[] = useMemo(() => {
    const byId = new Map<string, any>();
    enriched.forEach((r: any) => byId.set(r.id, r));
    return transactions.map(t => ({ ...t, ...(byId.get(t.id) || {}) })) as FullTx[];
  }, [transactions, enriched]);

  const rows = merged.map((tx) => {
    const itbis = Number(tx.itbis || 0);
    const total = Number(tx.amount || 0) - itbis;
    let bienes: number;
    let servicios: number;
    if (tx.monto_bienes == null && tx.monto_servicios == null) {
      const bs = tx.account_id ? coaBsMap[tx.account_id] : undefined;
      if (bs === "S") { servicios = total; bienes = 0; }
      else { bienes = total; servicios = 0; }
    } else {
      bienes = Number(tx.monto_bienes || 0);
      servicios = Number(tx.monto_servicios || 0);
    }
    const itbisAdel = Math.max(0, itbis - Number(tx.itbis_proporcionalidad || 0) - Number(tx.itbis_al_costo || 0));
    return {
      tx,
      rnc: tx.rnc?.replace(/[-\s]/g, "") || "",
      tipoId: getTipoId(tx.rnc),
      tipoBienes: tx.dgii_tipo_bienes_servicios || "",
      ncf: tx.document || "",
      ncfModificado: tx.ncf_modificado || "",
      fecha: fmtDateDDMMYYYY(tx.transaction_date),
      fechaPago: fmtDateDDMMYYYY(tx.purchase_date || tx.transaction_date),
      servicios: fmt2(servicios),
      bienes: fmt2(bienes),
      total: fmt2(bienes + servicios),
      itbisFact: fmt2(itbis),
      itbisRet: fmt2(tx.itbis_retenido),
      itbisProp: fmt2(tx.itbis_proporcionalidad),
      itbisCosto: fmt2(tx.itbis_al_costo),
      itbisAdel: fmt2(itbisAdel),
      itbisPerc: fmt2(tx.itbis_percibido),
      tipoRetIsr: tx.dgii_tipo_retencion_isr || "",
      isrRet: fmt2(tx.isr_retenido),
      isrPerc: fmt2(tx.isr_percibido),
      isc: fmt2(tx.isc),
      otros: fmt2(tx.otros_impuestos),
      propina: fmt2(tx.propina_legal),
      formaPago: getFormaDePago(tx.pay_method, bankAccounts),
    };
  });

  const headers = [
    "RNC/Cédula", "Tipo Id", "Tipo Bienes/Serv.", "NCF", "NCF Modificado",
    "Fecha Comprobante", "Fecha Pago", "Monto Servicios", "Monto Bienes", "Total Facturado",
    "ITBIS Facturado", "ITBIS Retenido", "ITBIS Proporcionalidad", "ITBIS al Costo",
    "ITBIS por Adelantar", "ITBIS Percibido", "Tipo Retención ISR", "Monto Retención ISR",
    "ISR Percibido", "ISC", "Otros Impuestos", "Propina Legal", "Forma de Pago",
  ];

  const handleCopy = () => {
    const lines = rows.map((r) => [
      r.rnc, r.tipoId, r.tipoBienes, r.ncf, r.ncfModificado, r.fecha, r.fechaPago,
      r.servicios, r.bienes, r.total, r.itbisFact, r.itbisRet, r.itbisProp, r.itbisCosto,
      r.itbisAdel, r.itbisPerc, r.tipoRetIsr, r.isrRet, r.isrPerc, r.isc, r.otros, r.propina, r.formaPago,
    ].join("\t"));
    navigator.clipboard.writeText([headers.join("\t"), ...lines].join("\n"));
    toast.success("Datos copiados al portapapeles");
  };

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("606");
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow([
      r.rnc, r.tipoId, r.tipoBienes, r.ncf, r.ncfModificado, r.fecha, r.fechaPago,
      r.servicios, r.bienes, r.total, r.itbisFact, r.itbisRet, r.itbisProp, r.itbisCosto,
      r.itbisAdel, r.itbisPerc, r.tipoRetIsr, r.isrRet, r.isrPerc, r.isc, r.otros, r.propina, r.formaPago,
    ]));
    ws.getRow(1).font = { bold: true };
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

  const handleDownloadTxt = async () => {
    if (!entityId) return;
    setDownloading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("generate_dgii_606", {
        p_year: year,
        p_month: month,
        p_entity_id: entityId,
      });
      if (error) throw error;
      const blob = new Blob([data as string], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `606_${year}${String(month).padStart(2, "0")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archivo 606 .TXT descargado");
    } catch (err: any) {
      const msg = err?.message || "";
      toast.error(msg || "Error al generar archivo .TXT");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleDownloadTxt} disabled={!entityId || downloading}>
          {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
          Descargar .TXT
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-1" /> Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Excel
        </Button>
      </div>
      <div className="border rounded-lg overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>RNC</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>NCF Mod.</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>F. Pago</TableHead>
              <TableHead>B/S</TableHead>
              <TableHead className="text-right">Servicios</TableHead>
              <TableHead className="text-right">Bienes</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">ITBIS</TableHead>
              <TableHead className="text-right">ITBIS Ret.</TableHead>
              <TableHead className="text-right">ITBIS Adel.</TableHead>
              <TableHead>Ret. ISR</TableHead>
              <TableHead className="text-right">ISR Ret.</TableHead>
              <TableHead className="text-right">ISC</TableHead>
              <TableHead className="text-right">Propina</TableHead>
              <TableHead>Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-muted-foreground py-8">
                  No hay compras para este período
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(r.tx)} title="Editar campos 606">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.rnc}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ncfModificado}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fecha}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fechaPago}</TableCell>
                  <TableCell title={TIPO_BIENES_SERVICIOS[r.tipoBienes] || ""}>{r.tipoBienes}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.servicios))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.bienes))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.total))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.itbisFact))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.itbisRet))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.itbisAdel))}</TableCell>
                  <TableCell title={TIPO_RETENCION_ISR[r.tipoRetIsr] || ""}>{r.tipoRetIsr}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.isrRet))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.isc))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatMoney(Number(r.propina))}</TableCell>
                  <TableCell>{r.formaPago}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground">
        Total registros: {rows.length} · Excel y .TXT incluyen las 23 columnas oficiales DGII
      </div>

      {editing && (
        <EnrichmentDialog
          tx={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["dgii606-enriched"] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EnrichmentDialog({ tx, onClose, onSaved }: { tx: FullTx; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ncf_modificado: tx.ncf_modificado || "",
    monto_bienes: tx.monto_bienes == null ? "" : String(tx.monto_bienes),
    monto_servicios: tx.monto_servicios == null ? "" : String(tx.monto_servicios),
    dgii_tipo_retencion_isr: tx.dgii_tipo_retencion_isr || "",
    isc: String(tx.isc ?? 0),
    propina_legal: String(tx.propina_legal ?? 0),
    otros_impuestos: String(tx.otros_impuestos ?? 0),
    itbis_proporcionalidad: String(tx.itbis_proporcionalidad ?? 0),
    itbis_al_costo: String(tx.itbis_al_costo ?? 0),
    itbis_percibido: String(tx.itbis_percibido ?? 0),
    isr_percibido: String(tx.isr_percibido ?? 0),
  });
  const [saving, setSaving] = useState(false);

  const num = (s: string) => (s === "" ? 0 : Number(s) || 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          ncf_modificado: form.ncf_modificado || null,
          monto_bienes: form.monto_bienes === "" ? null : num(form.monto_bienes),
          monto_servicios: form.monto_servicios === "" ? null : num(form.monto_servicios),
          dgii_tipo_retencion_isr: form.dgii_tipo_retencion_isr || null,
          isc: num(form.isc),
          propina_legal: num(form.propina_legal),
          otros_impuestos: num(form.otros_impuestos),
          itbis_proporcionalidad: num(form.itbis_proporcionalidad),
          itbis_al_costo: num(form.itbis_al_costo),
          itbis_percibido: num(form.itbis_percibido),
          isr_percibido: num(form.isr_percibido),
        })
        .eq("id", tx.id);
      if (error) throw error;
      toast.success("Detalle 606 actualizado");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle 606 — {tx.document || "(sin NCF)"} · {tx.name || ""}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2 text-sm">
          <div>
            <Label>NCF Modificado</Label>
            <Input value={form.ncf_modificado} onChange={(e) => setForm({ ...form, ncf_modificado: e.target.value.toUpperCase() })} className="font-mono" />
          </div>
          <div>
            <Label>Tipo Retención ISR</Label>
            <Select value={form.dgii_tipo_retencion_isr || "none"} onValueChange={(v) => setForm({ ...form, dgii_tipo_retencion_isr: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Ninguna —</SelectItem>
                {Object.entries(TIPO_RETENCION_ISR).map(([code, desc]) => (
                  <SelectItem key={code} value={code}>{code} - {desc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto Bienes</Label>
            <Input type="number" step="0.01" value={form.monto_bienes} onChange={(e) => setForm({ ...form, monto_bienes: e.target.value })} className="font-mono" placeholder="(auto)" />
          </div>
          <div>
            <Label>Monto Servicios</Label>
            <Input type="number" step="0.01" value={form.monto_servicios} onChange={(e) => setForm({ ...form, monto_servicios: e.target.value })} className="font-mono" placeholder="(auto)" />
          </div>
          <div>
            <Label>ITBIS Proporcionalidad</Label>
            <Input type="number" step="0.01" value={form.itbis_proporcionalidad} onChange={(e) => setForm({ ...form, itbis_proporcionalidad: e.target.value })} className="font-mono" />
          </div>
          <div>
            <Label>ITBIS al Costo</Label>
            <Input type="number" step="0.01" value={form.itbis_al_costo} onChange={(e) => setForm({ ...form, itbis_al_costo: e.target.value })} className="font-mono" />
          </div>
          <div>
            <Label>ITBIS Percibido</Label>
            <Input type="number" step="0.01" value={form.itbis_percibido} onChange={(e) => setForm({ ...form, itbis_percibido: e.target.value })} className="font-mono" />
          </div>
          <div>
            <Label>ISR Percibido</Label>
            <Input type="number" step="0.01" value={form.isr_percibido} onChange={(e) => setForm({ ...form, isr_percibido: e.target.value })} className="font-mono" />
          </div>
          <div>
            <Label>ISC</Label>
            <Input type="number" step="0.01" value={form.isc} onChange={(e) => setForm({ ...form, isc: e.target.value })} className="font-mono" />
          </div>
          <div>
            <Label>Otros Impuestos</Label>
            <Input type="number" step="0.01" value={form.otros_impuestos} onChange={(e) => setForm({ ...form, otros_impuestos: e.target.value })} className="font-mono" />
          </div>
          <div>
            <Label>Propina Legal (10%)</Label>
            <Input type="number" step="0.01" value={form.propina_legal} onChange={(e) => setForm({ ...form, propina_legal: e.target.value })} className="font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
