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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Lock, AlertTriangle, Briefcase } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteHrTab } from "@/lib/permissions";
import { createTransaction } from "@/lib/api";
import { formatDateLocal } from "@/lib/dateUtils";
import { numberToSpanishWords } from "@/lib/numberToWords";
import { format } from "date-fns";
import jsPDF from "jspdf";

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
  is_closed: boolean;
  created_at: string;
  service_providers: { name: string; cedula: string };
}

interface Account {
  code: string;
  spanish_description: string;
}

const emptyForm = {
  provider_id: "", service_date: formatDateLocal(new Date()),
  master_acct_code: "", description: "", amount: "", currency: "DOP", comments: "",
};

function isIncomplete(entry: { master_acct_code: string | null; description: string | null; amount: number | null }) {
  return !entry.master_acct_code || !entry.description || entry.amount == null;
}

export function ServicesView() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteHrTab(user?.role, "servicios");
  const [showClosed, setShowClosed] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ServiceEntry | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [closingEntry, setClosingEntry] = useState<ServiceEntry | null>(null);

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
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts")
        .select("code, spanish_description").order("code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["service-entries", showClosed],
    queryFn: async () => {
      let query = supabase.from("service_entries")
        .select("*, service_providers(name, cedula)")
        .order("service_date", { ascending: false });
      if (!showClosed) query = query.eq("is_closed", false);
      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm & { id?: string }) => {
      const payload = {
        provider_id: data.provider_id,
        service_date: data.service_date,
        master_acct_code: data.master_acct_code || null,
        description: data.description || null,
        amount: data.amount ? parseFloat(data.amount) : null,
        currency: data.currency,
        comments: data.comments || null,
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

  const closeMutation = useMutation({
    mutationFn: async (entry: ServiceEntry) => {
      // Generate receipt PDF
      generateReceipt(entry);

      // Create transaction
      await createTransaction({
        transaction_date: entry.service_date,
        master_acct_code: entry.master_acct_code || "",
        description: `Servicio: ${entry.description} - ${entry.service_providers.name}`,
        currency: entry.currency as "DOP" | "USD",
        amount: Number(entry.amount),
        is_internal: false,
      });

      // Mark as closed
      const { error } = await supabase.from("service_entries")
        .update({ is_closed: true }).eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-entries"] });
      queryClient.invalidateQueries({ queryKey: ["service-provider-history"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      setClosingEntry(null);
      toast({ title: "Servicio cerrado", description: "Transacción creada y recibo descargado." });
    },
    onError: (error) => {
      toast({ title: "Error al cerrar servicio", description: error.message, variant: "destructive" });
    },
  });

  const generateReceipt = (entry: ServiceEntry) => {
    const doc = new jsPDF();
    const amount = Number(entry.amount);
    const currencySymbol = entry.currency === "USD" ? "US$" : "RD$";

    // Greyscale header
    doc.setFillColor(240, 240, 240);
    doc.rect(0, 0, 210, 40, "F");
    doc.setFontSize(18);
    doc.setTextColor(50, 50, 50);
    doc.text("RECIBO DE SERVICIO", 105, 20, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Fecha: ${format(new Date(entry.service_date + "T12:00:00"), "dd/MM/yyyy")}`, 105, 32, { align: "center" });

    let y = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);

    // Provider info
    doc.text("Prestador:", 20, y);
    doc.setFont("helvetica", "bold");
    doc.text(entry.service_providers.name, 60, y);
    doc.setFont("helvetica", "normal");
    y += 10;
    doc.text("Cédula:", 20, y);
    doc.text(entry.service_providers.cedula, 60, y);
    y += 15;

    // Description
    doc.text("Descripción del Servicio:", 20, y);
    y += 8;
    doc.setFontSize(11);
    const descLines = doc.splitTextToSize(entry.description || "", 170);
    doc.text(descLines, 20, y);
    y += descLines.length * 6 + 10;

    // Amount numerical
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${currencySymbol} ${amount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`, 20, y);
    doc.setFont("helvetica", "normal");
    y += 10;

    // Amount in words
    doc.setFontSize(11);
    const words = numberToSpanishWords(amount, entry.currency);
    const wordLines = doc.splitTextToSize(`(${words})`, 170);
    doc.text(wordLines, 20, y);
    y += wordLines.length * 6 + 25;

    // Signature box
    doc.setDrawColor(150, 150, 150);
    doc.line(20, y, 100, y);
    y += 6;
    doc.setFontSize(10);
    doc.text("Firma", 20, y);
    y += 10;
    doc.text(`Nombre: ${entry.service_providers.name}`, 20, y);
    y += 6;
    doc.text(`Cédula: ${entry.service_providers.cedula}`, 20, y);

    doc.save(`Recibo_Servicio_${entry.service_providers.name.replace(/\s/g, "_")}_${entry.service_date}.pdf`);
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

  const handleCloseService = (entry: ServiceEntry) => {
    if (isIncomplete(entry)) {
      toast({ title: "Servicio incompleto", description: "Complete cuenta, descripción y monto antes de cerrar.", variant: "destructive" });
      return;
    }
    setClosingEntry(entry);
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
                <p className="text-sm text-muted-foreground">{openCount} servicios abiertos</p>
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
                {canWrite && <TableHead className="w-24 text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay servicios {showClosed ? "" : "abiertos"}
                </TableCell></TableRow>
              ) : (
                entries.map((entry) => {
                  const incomplete = !entry.is_closed && isIncomplete(entry);
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
                        {entry.amount != null
                          ? `${entry.currency === "USD" ? "US$" : "RD$"} ${Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={entry.is_closed ? "default" : "secondary"}>
                          {entry.is_closed ? "Cerrado" : "Abierto"}
                        </Badge>
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {!entry.is_closed && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(entry)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleCloseService(entry)} title="Cerrar">
                                  <Lock className="h-4 w-4" />
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
            <DialogTitle>{editingEntry ? "Editar Servicio" : "Agregar Servicio"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Prestador *</Label>
              <Select value={formData.provider_id} onValueChange={(v) => setFormData({ ...formData, provider_id: v })}>
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
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cuenta Maestra</Label>
              <Select value={formData.master_acct_code}
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
              <Label>Comentarios</Label>
              <Textarea value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Comentarios adicionales (opcional)" rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : editingEntry ? "Actualizar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <AlertDialog open={!!closingEntry} onOpenChange={(open) => !open && setClosingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar Servicio?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Esto hará lo siguiente:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Crear una transacción por {closingEntry?.currency === "USD" ? "US$" : "RD$"} {Number(closingEntry?.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</li>
                  <li>Descargar un recibo en PDF</li>
                  <li>Bloquear la edición de este servicio</li>
                </ul>
                <p className="mt-3 font-medium">Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => closingEntry && closeMutation.mutate(closingEntry)}
              disabled={closeMutation.isPending}>
              {closeMutation.isPending ? "Cerrando..." : "Cerrar Servicio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
