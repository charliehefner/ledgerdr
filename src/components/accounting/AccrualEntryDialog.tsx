import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { fetchAccounts } from "@/lib/api";
import { getDescription } from "@/lib/getDescription";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AccountRow {
  id: string;
  code: string;
  name?: string;
  account_type?: string;
  account_name?: string;
  english_description?: string | null;
  spanish_description?: string | null;
}

interface PeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  is_closed: boolean | null;
}

const COST_CENTERS = [
  { value: "general", label: "General" },
  { value: "agricultural", label: "Agrícola" },
  { value: "industrial", label: "Industrial" },
];

export function AccrualEntryDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { selectedEntityId } = useEntity();

  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"DOP" | "USD" | "EUR">("DOP");
  const [accrualDate, setAccrualDate] = useState<Date | undefined>(new Date());
  const [expenseAccountId, setExpenseAccountId] = useState<string>("");
  const [liabilityAccountId, setLiabilityAccountId] = useState<string>(""); // empty = use 2180
  const [costCenter, setCostCenter] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setReference("");
      setDescription("");
      setAmount("");
      setCurrency("DOP");
      setAccrualDate(new Date());
      setExpenseAccountId("");
      setLiabilityAccountId("");
      setCostCenter("general");
    }
  }, [open]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  // Fetch periods to compute reversal date preview
  const { data: periods = [] } = useQuery<PeriodRow[]>({
    queryKey: ["accounting_periods_for_accrual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("id, start_date, end_date, status, is_closed")
        .is("deleted_at", null)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data || []) as PeriodRow[];
    },
    enabled: open,
  });

  // Resolve default 2180 account id for the liability picker default
  const defaultLiabilityAccount = useMemo(
    () => accounts.find((a: any) => a.code === "2180"),
    [accounts]
  );
  const effectiveLiabilityAccountId =
    liabilityAccountId || (defaultLiabilityAccount as any)?.id || "";

  // Filter pickers by account_type
  const expenseAccounts = useMemo(
    () =>
      accounts.filter((a: any) =>
        ["EXPENSE", "ASSET"].includes(String(a.account_type || "").toUpperCase())
      ),
    [accounts]
  );
  const liabilityAccounts = useMemo(
    () =>
      accounts.filter(
        (a: any) => String(a.account_type || "").toUpperCase() === "LIABILITY"
      ),
    [accounts]
  );

  // Compute accrual + reversal periods/dates for the live preview
  const isPeriodOpen = (p: PeriodRow) => p.status === "open" && p.is_closed !== true;
  const accrualDateISO = accrualDate ? format(accrualDate, "yyyy-MM-dd") : "";
  const accrualPeriod = useMemo(
    () =>
      accrualDateISO
        ? periods.find(
            (p) => accrualDateISO >= p.start_date && accrualDateISO <= p.end_date
          )
        : undefined,
    [periods, accrualDateISO]
  );
  const reversalPeriod = useMemo(
    () =>
      accrualPeriod
        ? periods.find((p) => p.start_date > accrualPeriod.end_date && isPeriodOpen(p))
        : undefined,
    [periods, accrualPeriod]
  );

  const periodWarning =
    accrualDateISO && !accrualPeriod
      ? "La fecha no cae en ningún período contable definido."
      : accrualDateISO && accrualPeriod && !isPeriodOpen(accrualPeriod)
      ? "La fecha cae en un período cerrado o bloqueado."
      : !reversalPeriod && accrualPeriod
      ? "No hay un período abierto futuro para programar el reverso."
      : null;

  const expenseAcct = accounts.find((a: any) => a.id === expenseAccountId);
  const liabilityAcct = accounts.find(
    (a: any) => a.id === effectiveLiabilityAccountId
  );

  const amountNum = Number(amount);
  const canSubmit =
    !!selectedEntityId &&
    !!description.trim() &&
    !!expenseAccountId &&
    !!effectiveLiabilityAccountId &&
    expenseAccountId !== effectiveLiabilityAccountId &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !!accrualDateISO &&
    !!accrualPeriod &&
    isPeriodOpen(accrualPeriod) &&
    !!reversalPeriod &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("post-accrual", {
        body: {
          entity_id: selectedEntityId,
          accrual_date: accrualDateISO,
          expense_account_id: expenseAccountId,
          liability_account_id: liabilityAccountId || undefined,
          amount: amountNum,
          currency,
          cost_center: costCenter,
          description: description.trim(),
          reference: reference.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(
        `Acumulación creada. Reverso programado para ${(data as any).reversal_date}.`
      );
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["accrual_entries"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al crear la acumulación");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear acumulación (reverso automático)</DialogTitle>
          <DialogDescription>
            Reconozca un gasto antes de que llegue la factura. El sistema crea el asiento de
            acumulación en el período actual y un reverso automático en el primer día del
            siguiente período abierto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Referencia (proveedor)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: EDESUR"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Fecha de acumulación</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start font-normal h-11",
                    !accrualDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {accrualDate ? format(accrualDate, "dd MMM yyyy") : "Elegir fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar
                  mode="single"
                  selected={accrualDate}
                  onSelect={setAccrualDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="col-span-2 space-y-2">
            <Label className="text-xs">Descripción *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ej: Consumo eléctrico estimado de noviembre"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Monto *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Moneda</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="DOP">DOP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cuenta de gasto (DR) *</Label>
            <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent className="bg-popover max-h-[280px]">
                {expenseAccounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} - {getDescription(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cuenta de pasivo (CR)</Label>
            <Select
              value={effectiveLiabilityAccountId || ""}
              onValueChange={(v) => setLiabilityAccountId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={defaultLiabilityAccount ? "2180 (default)" : "—"} />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-[280px]">
                {liabilityAccounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} - {getDescription(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Centro de costo</Label>
            <Select value={costCenter} onValueChange={setCostCenter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {COST_CENTERS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Live period validation */}
        {periodWarning && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {periodWarning}
          </div>
        )}

        {/* Live preview */}
        {expenseAcct && liabilityAcct && reversalPeriod && amountNum > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="text-xs font-semibold">Vista previa de asientos</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <div className="space-y-1">
                <div className="font-medium">
                  Acumulación · {accrualDateISO}
                </div>
                <div>DR <strong>{(expenseAcct as any).code}</strong> {amountNum.toFixed(2)}</div>
                <div>CR <strong>{(liabilityAcct as any).code}</strong> {amountNum.toFixed(2)}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-1">
                <div className="font-medium">
                  Reverso · {reversalPeriod.start_date}
                </div>
                <div>DR <strong>{(liabilityAcct as any).code}</strong> {amountNum.toFixed(2)}</div>
                <div>CR <strong>{(expenseAcct as any).code}</strong> {amountNum.toFixed(2)}</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Los dos asientos se crean en estado borrador. El estado del registro de
              acumulación cambia a "reversado" automáticamente cuando el asiento de reverso
              se publica.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Creando..." : "Crear acumulación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
