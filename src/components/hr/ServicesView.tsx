import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Receipt, AlertTriangle, Briefcase } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteHrTab } from "@/lib/permissions";
import { formatDateLocal } from "@/lib/dateUtils";
import { numberToSpanishWords } from "@/lib/numberToWords";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { ServicePaymentDialog, ServicePaymentRecord } from "./ServicePaymentDialog";

interface ServiceProvider {
  id: string;
  name: string;
  cedula: string;
}

interface ServiceEntry {
  id: string;
  provider_id: string;
  service_date: string;
  master_acct_code: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  comments: string | null;
  pay_method: string | null;
  is_closed: boolean;
  committed_amount?: number | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  settlement_status?: string | null;
  ap_document_id?: string | null;
  created_at: string;
  transaction_id: string | null;
  service_providers: { name: string; cedula: string };
  transactions?: { legacy_id: number | null } | null;
}

interface Account {
  code: string;
  spanish_description: string;
}

const emptyForm = {
  provider_id: "", service_date: formatDateLocal(new Date()),
  master_acct_code: "", description: "", amount: "", currency: "DOP", comments: "", pay_method: "",
};

function isIncomplete(entry: { master_acct_code: string | null; description: string | null; amount: number | null }) {
  return !entry.master_acct_code || !entry.description || entry.amount == null;
}

export function ServicesView() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canWrite = canWriteHrTab(user?.role, "servicios");
  const [showClosed, setShowClosed] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ServiceEntry | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [paymentEntry, setPaymentEntry] = useState<ServiceEntry | null>(null);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts")
        .select("id, account_name, bank_name, account_type")
        .eq("is_active", true)
        .in("account_type", ["bank", "petty_cash"])
        .order("account_name");
      if (error) throw error;
      return data as { id: string; account_name: string; bank_name: string; account_type: string }[];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["service-providers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_providers")
        .select("id, name, cedula").eq("is_active", true).order("name");
      if (error) throw error;
      return data as ServiceProvider[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts")
        .select("account_code, spanish_description")
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return (data || []).map(row => ({ code: row.account_code, spanish_description: row.spanish_description || row.account_code })) as Account[];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["service-entries", showClosed],
    queryFn: async () => {
      let query = supabase.from("service_entries")
        .select("*, service_providers(name, cedula), transactions(legacy_id)")
        .order("service_date", { ascending: false });
      if (!showClosed) query = query.eq("is_closed", false);
      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm & { id?: string }) => {
      const parsedAmount = data.amount ? parseFloat(data.amount) : 0;
      const payload = {
        provider_id: data.provider_id,
        service_date: data.service_date,
        master_acct_code: data.master_acct_code || null,
        description: data.description || null,
        amount: parsedAmount || null,
        committed_amount: parsedAmount,
        remaining_amount: Math.max(parsedAmount - Number(editingEntry?.paid_amount || 0), 0),
        settlement_status: parsedAmount > 0 ? (Number(editingEntry?.paid_amount || 0) > 0 ? "partial" : "open") : "draft",
        currency: data.currency,
        comments: data.comments || null,
        pay_method: data.pay_method || null,
      };
      if (data.id) {
        const { error } = await supabase.from("service_entries").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-entries"] });
      queryClient.invalidateQueries({ queryKey: ["service-provider-history"] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData(emptyForm);
      toast({ title: editingEntry ? "Servicio actualizado" : "Servicio agregado" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const generateReceipt = (entry: ServiceEntry, payments: ServicePaymentRecord[] = []) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const amount = Number(entry.committed_amount ?? entry.amount ?? 0);
    const finalPayment = payments[payments.length - 1];
    const receiptDate = finalPayment?.payment_date || entry.service_date;
    const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const dateStr = format(new Date(receiptDate + "T12:00:00"), "dd/MM/yyyy");
    const formatCurrency = (val: number) =>
      new Intl.NumberFormat("es-DO", { style: "currency", currency: entry.currency, minimumFractionDigits: 2 }).format(val);

    const generateCopy = (yOffset: number) => {
      let y = yOffset + 8;

      // Header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE SERVICIO", pageWidth / 2, y, { align: "center" });
      y += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha: ${dateStr}`, pageWidth / 2, y, { align: "center" });
      y += 10;

      // Provider info box
      doc.setDrawColor(200);
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(15, y, pageWidth - 30, 14, 2, 2, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Prestador:", 20, y + 6);
      doc.text("Cédula:", 20, y + 11);
      doc.setFont("helvetica", "normal");
      doc.text(entry.service_providers.name, 50, y + 6);
      doc.text(entry.service_providers.cedula || "—", 50, y + 11);

      y += 20;

      // Table header
      doc.setFillColor(235, 235, 235);
      doc.roundedRect(15, y, pageWidth - 30, 7, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Cuenta", 20, y + 5);
      doc.text("Descripción", 55, y + 5);
      doc.text("Monto", pageWidth - 20, y + 5, { align: "right" });
      y += 9;

      // Data row
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(entry.master_acct_code || "—", 20, y);
      const descText = doc.splitTextToSize(entry.description || "—", 90);
      doc.text(descText, 55, y);
      doc.text(formatCurrency(amount), pageWidth - 20, y, { align: "right" });
      y += Math.max(descText.length * 4, 5);

      if (payments.length > 0) {
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Pagos realizados", 20, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        payments.forEach((payment) => {
          const paymentLine = `${format(new Date(payment.payment_date + "T12:00:00"), "dd/MM/yyyy")} · ${formatCurrency(payment.amount)}${payment.ncf ? ` · ${payment.ncf}` : ""}`;
          doc.text(paymentLine, 24, y);
          y += 4;
        });
        doc.setFont("helvetica", "bold");
        doc.text(`Total pagado: ${formatCurrency(paidTotal)}`, 24, y);
        doc.setFont("helvetica", "normal");
        y += 5;
      }

      // Comments if present
      if (entry.comments) {
        y += 2;
        doc.setFontSize(7);
        doc.setTextColor(100);
        const commentLines = doc.splitTextToSize(`Nota: ${entry.comments}`, pageWidth - 40);
        doc.text(commentLines, 20, y);
        doc.setTextColor(0);
        y += commentLines.length * 3.5;
      }

      // Total box
      y += 4;
      doc.setFillColor(160, 160, 160);
      doc.roundedRect(15, y, pageWidth - 30, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", 25, y + 8);
      doc.setFontSize(14);
      doc.text(formatCurrency(amount), pageWidth - 25, y + 8, { align: "right" });
      doc.setTextColor(0, 0, 0);

      // Amount in words
      y += 16;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const words = numberToSpanishWords(amount, entry.currency);
      const wordLines = doc.splitTextToSize(`(${words})`, pageWidth - 40);
      doc.text(wordLines, 20, y);
      y += wordLines.length * 4;

      // Signature lines
      const sigY = y + 8;
      doc.setDrawColor(150);
      doc.line(25, sigY, 85, sigY);
      doc.setFontSize(8);
      doc.text("Firma Prestador", 55, sigY + 4, { align: "center" });
      doc.line(pageWidth - 85, sigY, pageWidth - 25, sigY);
      doc.text("Firma Autorizada", pageWidth - 55, sigY + 4, { align: "center" });

      // Copy label
      const copyLabel = yOffset === 0 ? "COPIA EMPRESA" : "COPIA PRESTADOR";
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(copyLabel, pageWidth - 20, yOffset + 5, { align: "right" });
      doc.setTextColor(0);
    };

    // Top copy
    generateCopy(5);

    // Dashed cut line
    const middleY = 140;
    doc.setDrawColor(150);
    doc.setLineDashPattern([3, 2], 0);
    doc.line(10, middleY, pageWidth - 10, middleY);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text("✂ CORTAR AQUÍ", pageWidth / 2, middleY - 2, { align: "center" });
    doc.setTextColor(0);

    // Bottom copy
    generateCopy(145);

    const safeName = entry.service_providers.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    doc.save(`Recibo_Servicio_${safeName}_${entry.service_date}.pdf`);
  };

  const handleOpenDialog = (entry?: ServiceEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        provider_id: entry.provider_id,
        service_date: entry.service_date,
        master_acct_code: entry.master_acct_code || "",
        description: entry.description || "",
        amount: entry.amount != null ? String(entry.amount) : "",
        currency: entry.currency,
        comments: entry.comments || "",
        pay_method: entry.pay_method || "",
      });
    } else {
      setEditingEntry(null);
      setFormData(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.provider_id) {
      toast({ title: "Seleccione un prestador", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ ...formData, id: editingEntry?.id });
  };

  const handleRegisterPayment = (entry: ServiceEntry) => {
    if (isIncomplete(entry)) {
      toast({ title: "Servicio incompleto", description: "Complete cuenta, descripción y monto total antes de registrar cuotas.", variant: "destructive" });
      return;
    }
    setPaymentEntry(entry);
  };

  const handlePaymentRegistered = ({ result, payments }: { result: { is_final_payment?: boolean }, payments: ServicePaymentRecord[] }) => {
    if (result.is_final_payment && paymentEntry) {
      generateReceipt(paymentEntry, payments);
    }
    setPaymentEntry(null);
  };

  const openCount = entries.filter((e) => !e.is_closed).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">Servicios</CardTitle>
                 <p className="text-sm text-muted-foreground">{openCount} servicios pendientes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={showClosed} onCheckedChange={setShowClosed} id="show-closed" />
                <Label htmlFor="show-closed" className="text-sm">Mostrar Cerrados</Label>
              </div>
              {canWrite && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />Agregar Servicio
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                {showClosed && <TableHead className="text-center">Trans. #</TableHead>}
                {canWrite && <TableHead className="w-24 text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={showClosed ? 9 : 8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={showClosed ? 9 : 8} className="text-center py-8 text-muted-foreground">
                  No hay servicios {showClosed ? "" : "abiertos"}
                </TableCell></TableRow>
              ) : (
                 entries.map((entry) => {
                  const incomplete = !entry.is_closed && isIncomplete(entry);
                   const committedAmount = Number(entry.committed_amount ?? entry.amount ?? 0);
                   const remainingAmount = Number(entry.remaining_amount ?? Math.max(committedAmount - Number(entry.paid_amount || 0), 0));
                  return (
                    <TableRow key={entry.id} className={incomplete ? "bg-warning/10" : ""}>
                      <TableCell className="px-2">
                        {incomplete && <AlertTriangle className="h-4 w-4 text-warning" />}
                      </TableCell>
                      <TableCell className="font-medium">{entry.service_providers?.name}</TableCell>
                      <TableCell>{format(new Date(entry.service_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-mono">{entry.master_acct_code || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">{entry.description || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                         {committedAmount > 0
                           ? `${entry.currency === "USD" ? "US$" : "RD$"} ${committedAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant={entry.is_closed ? "default" : remainingAmount > 0 && Number(entry.paid_amount || 0) > 0 ? "outline" : "secondary"}>
                           {entry.is_closed ? "Pagado" : remainingAmount > 0 && Number(entry.paid_amount || 0) > 0 ? `Parcial · ${entry.currency === "USD" ? "US$" : "RD$"} ${remainingAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : "Abierto"}
                        </Badge>
                      </TableCell>
                      {showClosed && (
                        <TableCell className="text-center font-mono text-sm">
                          {entry.transactions?.legacy_id ?? "—"}
                        </TableCell>
                      )}
                      {canWrite && (
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                             {!entry.is_closed && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(entry)} title={t("common.edit")}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                 <Button variant="ghost" size="icon" onClick={() => handleRegisterPayment(entry)} title="Registrar pago">
                                   <Receipt className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? t("services.editService") : t("services.addService")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Prestador *</Label>
              <Select value={formData.provider_id || undefined} onValueChange={(v) => setFormData({ ...formData, provider_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar prestador" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cuenta Maestra</Label>
              <Select value={formData.master_acct_code || undefined}
                onValueChange={(v) => setFormData({ ...formData, master_acct_code: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} - {a.spanish_description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción del Servicio</Label>
              <Input value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ej: Soldadura de portón principal" />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0" value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Pagado desde *</Label>
              <Select value={formData.pay_method || undefined} onValueChange={(v) => setFormData({ ...formData, pay_method: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>{ba.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comentarios</Label>
              <Textarea value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Comentarios adicionales (opcional)" rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t("common.saving") : editingEntry ? t("common.update") : t("common.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ServicePaymentDialog
        open={!!paymentEntry}
        onOpenChange={(open) => !open && setPaymentEntry(null)}
        entry={paymentEntry}
        bankAccounts={bankAccounts}
        onPaymentRegistered={handlePaymentRegistered}
      />
    </div>
  );
}
