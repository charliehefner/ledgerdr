import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateLocal } from "@/lib/dateUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface BankAcct {
  id: string;
  account_name: string;
  account_type: string;
  currency: string | null;
}

interface Props {
  transaction: any | null;
  bankAccounts: BankAcct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditCreditCardPaymentDialog({
  transaction,
  bankAccounts,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const { t } = useLanguage();
  const [date, setDate] = useState<Date | undefined>();
  const [fromAccount, setFromAccount] = useState("");
  const [cardAccount, setCardAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [destAmount, setDestAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (transaction && open) {
      setDate(transaction.transaction_date ? new Date(transaction.transaction_date + "T00:00:00") : undefined);
      setFromAccount(transaction.pay_method || "");
      setCardAccount(transaction.destination_acct_code || "");
      setAmount(transaction.amount != null ? String(transaction.amount) : "");
      setDestAmount(transaction.destination_amount != null ? String(transaction.destination_amount) : "");
      setDescription(transaction.description || "");
    }
  }, [transaction, open]);

  const fromAcct = bankAccounts.find((a) => a.id === fromAccount);
  const cardAcct = bankAccounts.find((a) => a.id === cardAccount);
  const fromCur = fromAcct?.currency || "DOP";
  const toCur = cardAcct?.currency || "DOP";
  const isCrossCurrency = !!fromAcct && !!cardAcct && fromCur !== toCur;

  const banks = bankAccounts.filter((a) => a.account_type === "bank");
  const petty = bankAccounts.filter((a) => a.account_type === "petty_cash");
  const cards = bankAccounts.filter((a) => a.account_type === "credit_card");

  const isValid = () => {
    if (!date || !fromAccount || !cardAccount || !amount) return false;
    if (fromAccount === cardAccount) return false;
    if (parseFloat(amount) <= 0) return false;
    if (isCrossCurrency && !destAmount) return false;
    return true;
  };

  const handleSave = async () => {
    if (!transaction || !isValid()) {
      if (isCrossCurrency && !destAmount)
        toast.error("Ingrese monto aplicado para pago multi-moneda");
      else toast.error(t("txForm.requiredFields"));
      return;
    }
    setSubmitting(true);
    try {
      // Reuses the same RPC as internal transfers — both edit a transaction
      // whose pay_method/destination_acct_code reference bank_accounts rows.
      const { error } = await supabase.rpc("update_internal_transfer" as any, {
        p_transaction_id: transaction.id,
        p_date: formatDateLocal(date!),
        p_from_account: fromAccount,
        p_to_account: cardAccount,
        p_amount: parseFloat(amount),
        p_destination_amount: isCrossCurrency ? parseFloat(destAmount) : null,
        p_description: description,
      });
      if (error) throw error;
      toast.success("Pago actualizado");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Pago de Tarjeta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {transaction?.id && (
            <p className="text-xs text-muted-foreground font-mono">ID: {transaction.id}</p>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Banco / Caja Origen *</Label>
              <Select value={fromAccount || undefined} onValueChange={setFromAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {banks.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground">Bancos</SelectLabel>
                      {banks.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.account_name} ({a.currency || "DOP"})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {petty.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">Caja Chica</SelectLabel>
                        {petty.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_name} ({a.currency || "DOP"})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              {fromAcct && <p className="text-xs text-muted-foreground">Moneda: {fromCur}</p>}
            </div>

            <div className="space-y-2">
              <Label>Tarjeta *</Label>
              <Select value={cardAccount || undefined} onValueChange={setCardAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {cards.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} ({a.currency || "DOP"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cardAcct && <p className="text-xs text-muted-foreground">Moneda: {toCur}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Monto Pagado ({fromCur}) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>
            {isCrossCurrency && (
              <>
                <div className="space-y-2">
                  <Label>Aplicado a Tarjeta ({toCur}) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={destAmount}
                    onChange={(e) => setDestAmount(e.target.value)}
                    placeholder="0.00"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tasa Implícita</Label>
                  <p className="text-sm font-mono text-muted-foreground pt-2">
                    {amount && destAmount && parseFloat(amount) > 0
                      ? (parseFloat(destAmount) / parseFloat(amount)).toFixed(4)
                      : "—"}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concepto del pago"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting || !isValid()}>
            {submitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
