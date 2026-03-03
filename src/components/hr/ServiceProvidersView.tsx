import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, UserCheck, UserX, Search, Wrench } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteHrTab } from "@/lib/permissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface ServiceProvider {
  id: string;
  name: string;
  cedula: string;
  bank: string | null;
  bank_account_type: string | null;
  currency: string | null;
  bank_account_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceEntry {
  id: string;
  service_date: string;
  description: string | null;
  amount: number | null;
  currency: string;
  is_closed: boolean;
}

const BANKS = [
  "Popular", "BHD", "Reservas", "Santa Cruz", "Scotiabank",
  "BanReservas", "Banesco", "Asociación Popular", "Otro"
];

const emptyForm = {
  name: "", cedula: "", bank: "", bank_account_type: "savings" as string,
  currency: "DOP" as string, bank_account_number: "",
};

export function ServiceProvidersView() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canWrite = canWriteHrTab(user?.role, "prestadores");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [historyProvider, setHistoryProvider] = useState<ServiceProvider | null>(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["service-providers", showInactive],
    queryFn: async () => {
      let query = supabase.from("service_providers").select("*").order("name");
      if (!showInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceProvider[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["service-provider-history", historyProvider?.id],
    enabled: !!historyProvider,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_entries")
        .select("id, service_date, description, amount, currency, is_closed")
        .eq("provider_id", historyProvider!.id)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return data as ServiceEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm & { id?: string }) => {
      const payload = {
        name: data.name, cedula: data.cedula,
        bank: data.bank || null,
        bank_account_type: data.bank_account_type || null,
        currency: data.currency || "DOP",
        bank_account_number: data.bank_account_number || null,
      };
      if (data.id) {
        const { error } = await supabase.from("service_providers").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_providers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-providers"] });
      setIsDialogOpen(false);
      setEditingProvider(null);
      setFormData(emptyForm);
      toast({ title: editingProvider ? "Prestador actualizado" : "Prestador agregado" });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate key") || error.message?.includes("service_providers_cedula_key")) {
        toast({ title: "Error", description: "Ya existe un prestador con esta cédula.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("service_providers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["service-providers"] });
      toast({ title: v.is_active ? "Prestador activado" : "Prestador desactivado" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const filtered = providers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cedula.includes(searchTerm)
  );

  const handleOpenDialog = (provider?: ServiceProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name, cedula: provider.cedula,
        bank: provider.bank || "", bank_account_type: provider.bank_account_type || "savings",
        currency: provider.currency || "DOP", bank_account_number: provider.bank_account_number || "",
      });
    } else {
      setEditingProvider(null);
      setFormData(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.cedula.trim()) {
      toast({ title: "Nombre y cédula son requeridos", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ ...formData, id: editingProvider?.id });
  };

  const activeCount = providers.filter((p) => p.is_active).length;
  const inactiveCount = providers.filter((p) => !p.is_active).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">Registro de Prestadores</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {activeCount} activos{inactiveCount > 0 && `, ${inactiveCount} inactivos`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={showInactive ? "secondary" : "outline"} size="sm"
                onClick={() => setShowInactive(!showInactive)}>
                {showInactive ? "Ocultar Inactivos" : "Mostrar Inactivos"}
              </Button>
              {canWrite && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />Agregar Prestador
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o cédula..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                {canWrite && <TableHead className="w-24 text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No se encontraron prestadores" : "No hay prestadores registrados"}
                </TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className={`${!p.is_active ? "opacity-60" : ""} cursor-pointer hover:bg-muted/50`}
                    onClick={() => setHistoryProvider(p)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono">{p.cedula}</TableCell>
                    <TableCell>{p.bank || "—"}</TableCell>
                    <TableCell>{p.bank_account_type === "current" ? t("common.checking") : t("common.savings")}</TableCell>
                    <TableCell>{p.currency || "DOP"}</TableCell>
                    <TableCell className="font-mono">{p.bank_account_number || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? t("common.active") : t("common.inactive")}</Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(p)} title={t("common.edit")}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title={p.is_active ? t("common.deactivate") : t("common.activate")}
                            onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                            {p.is_active ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-primary" />}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProvider ? t("providers.editProvider") : t("providers.addProvider")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")} *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("common.fullName")} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>{t("common.cedula")} *</Label>
              <Input value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                placeholder="000-0000000-0" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.bank")}</Label>
              <Select value={formData.bank} onValueChange={(v) => setFormData({ ...formData, bank: v })}>
                <SelectTrigger><SelectValue placeholder={t("common.selectBank")} /></SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.accountType")}</Label>
                <Select value={formData.bank_account_type}
                  onValueChange={(v) => setFormData({ ...formData, bank_account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">{t("common.savings")}</SelectItem>
                    <SelectItem value="current">{t("common.checking")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("common.currency")}</Label>
                <Select value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}>
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
              <Label>{t("common.bankAccount")}</Label>
              <Input value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="Número de cuenta bancaria" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t("common.saving") : editingProvider ? t("common.update") : t("common.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyProvider} onOpenChange={(open) => !open && setHistoryProvider(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("services.serviceHistory")} — {historyProvider?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead className="text-center">{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("services.noServicesRecorded")}</TableCell></TableRow>
                ) : (
                  history.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{format(new Date(s.service_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{s.description || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {s.amount != null ? `${s.currency} ${Number(s.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.is_closed ? "default" : "secondary"}>{s.is_closed ? t("common.closed") : t("common.open")}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
