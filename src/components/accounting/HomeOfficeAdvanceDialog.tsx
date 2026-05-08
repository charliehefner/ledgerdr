import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Kind =
  | "cash_transfer"
  | "equipment_capitalize"
  | "equipment_cip"
  | "equipment_inventory"
  | "expense_paid_on_behalf"
  | "other";

const KIND_LABELS: Record<Kind, string> = {
  cash_transfer: "Transferencia de efectivo",
  equipment_capitalize: "Equipo (capitalizar a activo fijo)",
  equipment_cip: "Equipo (proyecto en curso – CIP)",
  equipment_inventory: "Equipo / inventario",
  expense_paid_on_behalf: "Gasto pagado por la matriz",
  other: "Otro",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partyId: string;
  partyCurrency: string;
}

export function HomeOfficeAdvanceDialog({ open, onOpenChange, partyId, partyCurrency }: Props) {
  const { user } = useAuth();
  const { selectedEntityId, requireEntity } = useEntity();
  const qc = useQueryClient();

  const [date, setDate] = useState<Date>(new Date());
  const [kind, setKind] = useState<Kind>("cash_transfer");
  const [currency, setCurrency] = useState<string>(partyCurrency);
  const [amountFc, setAmountFc] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [targetAccountId, setTargetAccountId] = useState<string>("");
  const [cipProjectId, setCipProjectId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [interestRatePct, setInterestRatePct] = useState<string>("");
  const [interestBasis, setInterestBasis] = useState<string>("inherit");
  const [error, setError] = useState<string | null>(null);

  const dateStr = format(date, "yyyy-MM-dd");
  const { rate: officialRate } = useExchangeRate(dateStr);

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setKind("cash_transfer");
      setCurrency(partyCurrency);
      setAmountFc("");
      setFxRate("");
      setBankAccountId("");
      setTargetAccountId("");
      setCipProjectId("");
      setReference("");
      setDescription("");
      setInterestRatePct("");
      setInterestBasis("inherit");
      setError(null);
    }
  }, [open, partyCurrency]);

  useEffect(() => {
    if (currency === "DOP") {
      setFxRate("1");
    } else if (officialRate && !fxRate) {
      setFxRate(String(officialRate));
    }
  }, [currency, officialRate]); // eslint-disable-line

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["ho-bank-accounts", selectedEntityId],
    queryFn: async () => {
      const q = supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, currency, chart_account_id, account_type")
        .eq("is_active", true)
        .order("account_name");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["ho-coa-postable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: cipProjects = [] } = useQuery({
    queryKey: ["ho-cip-projects", selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("cip_projects")
        .select("id, name, cip_account_code, status")
        .eq("status", "open")
        .is("deleted_at", null)
        .order("name");
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: open && kind === "equipment_cip",
  });

  // Resolve target_account_id based on kind selection
  const resolvedTarget = useMemo(() => {
    if (kind === "cash_transfer") {
      const ba = bankAccounts.find((b) => b.id === bankAccountId);
      return ba?.chart_account_id || null;
    }
    if (kind === "equipment_cip") {
      const proj = cipProjects.find((p) => p.id === cipProjectId);
      if (!proj) return null;
      const acct = accounts.find((a) => a.account_code === proj.cip_account_code);
      return acct?.id || null;
    }
    return targetAccountId || null;
  }, [kind, bankAccountId, cipProjectId, targetAccountId, bankAccounts, cipProjects, accounts]);

  const filteredTargetAccounts = useMemo(() => {
    if (kind === "equipment_capitalize") return accounts.filter((a) => a.account_type === "ASSET");
    if (kind === "equipment_inventory") return accounts.filter((a) => a.account_code.startsWith("14"));
    if (kind === "expense_paid_on_behalf") return accounts.filter((a) => a.account_type === "EXPENSE");
    return accounts;
  }, [kind, accounts]);

  const submit = useMutation({
    mutationFn: async () => {
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione una entidad específica.");
      if (!resolvedTarget) throw new Error("Falta la cuenta destino.");
      const amt = Number(amountFc);
      const fx = Number(fxRate);
      if (!(amt > 0)) throw new Error("Monto inválido.");
      if (!(fx > 0)) throw new Error("Tasa de cambio inválida.");

      const { data, error: e } = await supabase.rpc("post_home_office_advance", {
        p_party_id: partyId,
        p_entity_id: entityId,
        p_advance_date: dateStr,
        p_kind: kind,
        p_currency: currency,
        p_amount_fc: amt,
        p_fx_rate: fx,
        p_target_account_id: resolvedTarget,
        p_user_id: user?.id!,
        p_reference: reference || null,
        p_description: description || null,
        p_cip_project_id: kind === "equipment_cip" ? cipProjectId : null,
        p_bank_account_id: kind === "cash_transfer" ? bankAccountId : null,
      });
      if (e) throw e;
      return data;
    },
    onSuccess: () => {
      toast.success("Entrada registrada y posteada.");
      qc.invalidateQueries({ queryKey: ["home-office-balance"] });
      qc.invalidateQueries({ queryKey: ["home-office-advances"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      onOpenChange(false);
    },
    onError: (e: any) => setError(e.message || "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submit.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva entrada de Casa Matriz</DialogTitle>
          <DialogDescription>
            Registra un aporte de la oficina principal. Postea Dr [destino] / Cr 2160.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="SEK">SEK</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="DOP">DOP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Monto ({currency})</Label>
              <Input type="number" step="0.01" value={amountFc} onChange={(e) => setAmountFc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tasa</Label>
              <Input type="number" step="0.0001" value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
            </div>
          </div>

          {kind === "cash_transfer" && (
            <div className="space-y-1">
              <Label>Cuenta bancaria receptora</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.account_name} — {b.bank_name} ({b.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "equipment_cip" && (
            <div className="space-y-1">
              <Label>Proyecto CIP</Label>
              <Select value={cipProjectId} onValueChange={setCipProjectId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
                <SelectContent>
                  {cipProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.cip_account_code}] {p.name}
                    </SelectItem>
                  ))}
                  {cipProjects.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Crea un proyecto en la pestaña CIP primero.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {(kind === "equipment_capitalize" ||
            kind === "equipment_inventory" ||
            kind === "expense_paid_on_behalf" ||
            kind === "other") && (
            <div className="space-y-1">
              <Label>Cuenta destino (Débito)</Label>
              <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredTargetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_code} — {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Wire #, Factura, etc." />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => { setError(null); submit.mutate(); }} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
