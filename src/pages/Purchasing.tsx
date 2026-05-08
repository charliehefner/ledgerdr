import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, PackageCheck, X, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type POLine = {
  id?: string;
  line_no?: number;
  item_id?: string | null;
  description: string;
  account_id?: string | null;
  qty_ordered: number;
  qty_received?: number;
  qty_invoiced?: number;
  unit_price: number;
  tax_rate: number;
  line_total?: number;
};

type PO = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  contact_name: string;
  status: string;
  currency: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  notes: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-100 text-blue-800",
  partially_received: "bg-amber-100 text-amber-800",
  received: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

const MATCH_COLORS: Record<string, string> = {
  matched: "bg-emerald-100 text-emerald-800",
  variance: "bg-amber-100 text-amber-800",
  awaiting_receipt: "bg-blue-100 text-blue-800",
  not_applicable: "bg-muted text-muted-foreground",
};

export default function Purchasing() {
  const [tab, setTab] = useState("orders");

  return (
    <MainLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Compras (PO)</h1>
          <p className="text-sm text-muted-foreground">
            Órdenes de compra, recepción de mercancía y conciliación a tres bandas.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="orders">Órdenes de compra</TabsTrigger>
            <TabsTrigger value="receipts">Recepciones</TabsTrigger>
            <TabsTrigger value="match">Conciliación</TabsTrigger>
            <TabsTrigger value="settings">Tolerancias</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4"><PurchaseOrders /></TabsContent>
          <TabsContent value="receipts" className="mt-4"><GoodsReceiptsView /></TabsContent>
          <TabsContent value="match" className="mt-4"><MatchStatus /></TabsContent>
          <TabsContent value="settings" className="mt-4"><PurchasingSettings /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ─── Purchase Orders ───────────────────────────────────────────
function PurchaseOrders() {
  const { selectedEntityId } = useEntity();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailPo, setDetailPo] = useState<PO | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data as PO[];
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_purchase_order", { p_po_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("PO cancelada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Órdenes de compra</CardTitle>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nueva PO
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id} className="cursor-pointer" onClick={() => setDetailPo(po)}>
                  <TableCell className="font-mono">{po.po_number}</TableCell>
                  <TableCell>{po.contact_name}</TableCell>
                  <TableCell>{format(new Date(po.order_date), "dd MMM yyyy").toUpperCase()}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[po.status]}>{po.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">
                    {po.currency} {po.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {po.status === "open" && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("¿Cancelar esta PO?")) cancelMut.mutate(po.id);
                      }}><X className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Sin órdenes de compra
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <PurchaseOrderDialog open={open} onClose={() => setOpen(false)} />
      <PurchaseOrderDetail po={detailPo} onClose={() => setDetailPo(null)} />
    </Card>
  );
}

// ─── PO create dialog ──────────────────────────────────────────
function PurchaseOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedEntityId } = useEntity();
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([
    { description: "", qty_ordered: 1, unit_price: 0, tax_rate: 0 },
  ]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("id,name").eq("is_active", true).order("name");
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-posting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id,account_code,account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data;
    },
  });

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.qty_ordered * l.unit_price * (1 + l.tax_rate / 100), 0),
    [lines]
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId) throw new Error("Seleccione una entidad");
      if (!contactName) throw new Error("Indique el proveedor");
      const valid = lines.filter((l) => l.description && l.qty_ordered > 0);
      if (valid.length === 0) throw new Error("Agregue al menos una línea válida");
      const { data, error } = await supabase.rpc("create_purchase_order", {
        p_entity_id: selectedEntityId,
        p_supplier_id: supplierId || null,
        p_contact_name: contactName,
        p_currency: currency,
        p_order_date: orderDate,
        p_expected_date: expectedDate || null,
        p_notes: notes || null,
        p_lines: valid as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("PO creada");
      onClose();
      setSupplierId(""); setContactName(""); setNotes(""); setExpectedDate("");
      setLines([{ description: "", qty_ordered: 1, unit_price: 0, tax_rate: 0 }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva orden de compra</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Proveedor (registrado)</Label>
            <Select value={supplierId} onValueChange={(v) => {
              setSupplierId(v);
              const s = suppliers.find((x: any) => x.id === v);
              if (s) setContactName(s.name);
            }}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nombre del proveedor *</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DOP">DOP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <Label>Fecha esperada</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <Label>Líneas</Label>
            <Button size="sm" variant="outline" onClick={() =>
              setLines([...lines, { description: "", qty_ordered: 1, unit_price: 0, tax_rate: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Línea
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="w-20">Cant.</TableHead>
                <TableHead className="w-28">Precio</TableHead>
                <TableHead className="w-20">ITBIS%</TableHead>
                <TableHead className="text-right w-28">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const lineTotal = l.qty_ordered * l.unit_price * (1 + l.tax_rate / 100);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Input value={l.description} onChange={(e) =>
                        setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    </TableCell>
                    <TableCell>
                      <Select value={l.account_id ?? ""} onValueChange={(v) =>
                        setLines(lines.map((x, j) => j === i ? { ...x, account_id: v } : x))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.account_code} {a.account_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" value={l.qty_ordered} onChange={(e) =>
                      setLines(lines.map((x, j) => j === i ? { ...x, qty_ordered: +e.target.value } : x))} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_price} onChange={(e) =>
                      setLines(lines.map((x, j) => j === i ? { ...x, unit_price: +e.target.value } : x))} /></TableCell>
                    <TableCell><Input type="number" value={l.tax_rate} onChange={(e) =>
                      setLines(lines.map((x, j) => j === i ? { ...x, tax_rate: +e.target.value } : x))} /></TableCell>
                    <TableCell className="text-right font-mono">
                      {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end font-mono text-lg">
            Total: {currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            Crear PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PO detail drawer ──────────────────────────────────────────
function PurchaseOrderDetail({ po, onClose }: { po: PO | null; onClose: () => void }) {
  const { data: linesData = [] } = useQuery({
    queryKey: ["po-lines", po?.id],
    queryFn: async () => {
      if (!po) return [];
      const { data, error } = await supabase
        .from("purchase_order_lines").select("*").eq("po_id", po.id).order("line_no");
      if (error) throw error;
      return data;
    },
    enabled: !!po,
  });

  if (!po) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{po.po_number} · {po.contact_name}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">
          {format(new Date(po.order_date), "dd MMM yyyy").toUpperCase()} · <Badge className={STATUS_COLORS[po.status]}>{po.status}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Ord.</TableHead>
              <TableHead className="text-right">Recib.</TableHead>
              <TableHead className="text-right">Fact.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linesData.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell>{l.line_no}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                <TableCell className="text-right font-mono">{l.qty_received}</TableCell>
                <TableCell className="text-right font-mono">{l.qty_invoiced}</TableCell>
                <TableCell className="text-right font-mono">{l.unit_price}</TableCell>
                <TableCell className="text-right font-mono">{l.line_total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

// ─── Goods Receipts ────────────────────────────────────────────
function GoodsReceiptsView() {
  const { selectedEntityId } = useEntity();
  const [open, setOpen] = useState(false);

  const { data: receipts = [] } = useQuery({
    queryKey: ["goods_receipts", selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("goods_receipts")
        .select("id,gr_number,received_date,notes,po_id,purchase_orders(po_number,contact_name)")
        .order("created_at", { ascending: false });
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recepciones de mercancía</CardTitle>
        <Button onClick={() => setOpen(true)}>
          <PackageCheck className="h-4 w-4 mr-2" /> Nueva recepción
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GR #</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((g: any) => (
              <TableRow key={g.id}>
                <TableCell className="font-mono">{g.gr_number}</TableCell>
                <TableCell className="font-mono">{g.purchase_orders?.po_number}</TableCell>
                <TableCell>{g.purchase_orders?.contact_name}</TableCell>
                <TableCell>{format(new Date(g.received_date), "dd MMM yyyy").toUpperCase()}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{g.notes}</TableCell>
              </TableRow>
            ))}
            {receipts.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Sin recepciones
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <GoodsReceiptDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function GoodsReceiptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedEntityId } = useEntity();
  const qc = useQueryClient();
  const [poId, setPoId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const { data: openPos = [] } = useQuery({
    queryKey: ["po-open", selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("id,po_number,contact_name")
        .in("status", ["open", "partially_received"]);
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: poLines = [] } = useQuery({
    queryKey: ["po-lines-recv", poId],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_order_lines")
        .select("*").eq("po_id", poId).order("line_no");
      if (error) throw error;
      return data;
    },
    enabled: !!poId,
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId || !poId) throw new Error("Seleccione PO");
      const lines = Object.entries(qtys)
        .filter(([, v]) => v > 0)
        .map(([po_line_id, qty_received]) => ({ po_line_id, qty_received }));
      if (lines.length === 0) throw new Error("Indique cantidad recibida");
      const { error } = await supabase.rpc("receive_goods", {
        p_entity_id: selectedEntityId, p_po_id: poId,
        p_received_date: date, p_notes: notes || null, p_lines: lines as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goods_receipts"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Recepción registrada");
      onClose(); setPoId(""); setQtys({}); setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Registrar recepción</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Orden de compra</Label>
            <Select value={poId} onValueChange={setPoId}>
              <SelectTrigger><SelectValue placeholder="Seleccione…" /></SelectTrigger>
              <SelectContent>
                {openPos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.po_number} · {p.contact_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {poId && (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="w-32">Recibir ahora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poLines.map((l: any) => {
                const pending = l.qty_ordered - l.qty_received;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                    <TableCell className="text-right font-mono">{l.qty_received}</TableCell>
                    <TableCell className="text-right font-mono">{pending}</TableCell>
                    <TableCell>
                      <Input type="number" value={qtys[l.id] ?? ""} onChange={(e) =>
                        setQtys({ ...qtys, [l.id]: +e.target.value })} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Match Status ──────────────────────────────────────────────
function MatchStatus() {
  const { selectedEntityId } = useEntity();
  const qc = useQueryClient();

  const { data: docs = [] } = useQuery({
    queryKey: ["apar-with-po", selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("ap_ar_documents")
        .select("id,document_number,contact_name,document_date,total_amount,currency,match_status,po_id,purchase_orders(po_number)")
        .not("po_id", "is", null)
        .order("document_date", { ascending: false });
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const revalidate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("validate_po_invoice_match", { p_apar_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apar-with-po"] });
      toast.success("Conciliación actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-sm text-blue-900 dark:text-blue-100">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          El saldo de la cuenta <strong>2120 (GR/IR)</strong> al cierre del mes representa
          mercancía recibida pendiente de facturar. Es un pasivo devengado válido —
          no se requiere asiento manual.
        </span>
      </div>
      <Card>
        <CardHeader><CardTitle>Conciliación PO ↔ Factura</CardTitle></CardHeader>
        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono">{d.document_number ?? "—"}</TableCell>
                <TableCell className="font-mono">{d.purchase_orders?.po_number}</TableCell>
                <TableCell>{d.contact_name}</TableCell>
                <TableCell>{format(new Date(d.document_date), "dd MMM yyyy").toUpperCase()}</TableCell>
                <TableCell className="text-right font-mono">
                  {d.currency} {Number(d.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell><Badge className={MATCH_COLORS[d.match_status]}>{d.match_status}</Badge></TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => revalidate.mutate(d.id)}>Revalidar</Button>
                </TableCell>
              </TableRow>
            ))}
            {docs.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                Sin facturas vinculadas a PO
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}

// ─── Settings ──────────────────────────────────────────────────
function PurchasingSettings() {
  const { selectedEntityId } = useEntity();
  const qc = useQueryClient();
  const [qty, setQty] = useState(5);
  const [price, setPrice] = useState(5);
  const [threeWay, setThreeWay] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["purchasing-settings", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const { data, error } = await supabase.from("purchasing_settings")
        .select("*").eq("entity_id", selectedEntityId).maybeSingle();
      if (error) throw error;
      if (data) {
        setQty(Number(data.qty_tolerance_pct));
        setPrice(Number(data.price_tolerance_pct));
        setThreeWay(data.three_way_required);
      }
      return data;
    },
    enabled: !!selectedEntityId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId) throw new Error("Seleccione una entidad");
      const { error } = await supabase.from("purchasing_settings").upsert({
        entity_id: selectedEntityId,
        qty_tolerance_pct: qty,
        price_tolerance_pct: price,
        three_way_required: threeWay,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchasing-settings"] });
      toast.success("Tolerancias guardadas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!selectedEntityId) return <p className="text-muted-foreground text-sm">Seleccione una entidad para configurar tolerancias.</p>;
  if (isLoading) return <p className="text-muted-foreground text-sm">Cargando…</p>;

  return (
    <Card>
      <CardHeader><CardTitle>Tolerancias y conciliación</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div>
          <Label>Tolerancia de cantidad (%)</Label>
          <Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            % máximo permitido al recibir más de lo pedido por línea.
          </p>
        </div>
        <div>
          <Label>Tolerancia de precio/total (%)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Diferencia permitida entre valor recibido y total facturado.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Three-way match obligatorio</Label>
            <p className="text-xs text-muted-foreground">
              Bloquea facturar PO sin recepción dentro de tolerancia.
            </p>
          </div>
          <Switch checked={threeWay} onCheckedChange={setThreeWay} />
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Guardar</Button>
      </CardContent>
    </Card>
  );
}
