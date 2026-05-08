import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partyId: string;
  partyCurrency: string;
}

export function HomeOfficeRepaymentDialog({ open, onOpenChange, partyId, partyCurrency }: Props) {
  const { user } = useAuth();
  const { requireEntity } = useEntity();
  const qc = useQueryClient();

  const [date, setDate] = useState<Date>(new Date());
  const [currency, setCurrency] = useState(partyCurrency);
  const [amountFc, setAmountFc] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dateStr = format(date, "yyyy-MM-dd");
  const { rate: officialRate } = useExchangeRate(dateStr);

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setCurrency(partyCurrency);
      setAmountFc("");
      setFxRate("");
      setBankAccountId("");
      setReference("");
      setDescription("");
      setError(null);
    }
  }, [open, partyCurrency]);

  useEffect(() => {
    if (currency === "DOP") setFxRate("1");
    else if (officialRate && !fxRate) setFxRate(String(officialRate));
  }, [currency, officialRate]); // eslint-disable-line

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["ho-repay-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, currency")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione una entidad.");
      if (!bankAccountId) throw new Error("Seleccione cuenta bancaria.");
      const amt = Number(amountFc);
      const fx = Number(fxRate);
      if (!(amt > 0)) throw new Error("Monto inválido.");
      if (!(fx > 0)) throw new Error("Tasa inválida.");

      const { data, error: e } = await supabase.rpc("post_home_office_repayment", {
        p_party_id: partyId,
        p_entity_id: entityId,
        p_repayment_date: dateStr,
        p_currency: currency,
        p_amount_fc: amt,
        p_fx_rate: fx,
        p_bank_account_id: bankAccountId,
        p_user_id: user?.id!,
        p_reference: reference || null,
        p_description: description || null,
      });
      if (e) throw e;
      return data;
    },
    onSuccess: () => {
      toast.success("Repago registrado.");
      qc.invalidateQueries({ queryKey: ["home-office-balance"] });
      qc.invalidateQueries({ queryKey: ["home-office-repayments"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      onOpenChange(false);
    },
    onError: (e: any) => setError(e.message || "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submit.isPending) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repago a Casa Matriz</DialogTitle>
          <DialogDescription>
            Postea Dr 2160 / Cr Banco. La diferencia FX realizada se postea a 8510.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
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

          <div className="space-y-1">
            <Label>Cuenta bancaria de salida</Label>
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

          <div className="space-y-1">
            <Label>Referencia</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>Cancelar</Button>
          <Button onClick={() => { setError(null); submit.mutate(); }} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Postear repago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
