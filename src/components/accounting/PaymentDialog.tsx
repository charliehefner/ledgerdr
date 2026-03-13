import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    contact_name: string;
    document_number: string | null;
    currency: string;
    total_amount: number;
    amount_paid: number;
    balance_remaining: number;
  } | null;
}

export function PaymentDialog({ open, onOpenChange, document }: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!document) return;
      const amount = parseFloat(paymentAmount);
      if (!amount || amount <= 0) throw new Error("Monto inválido");
      if (amount > document.balance_remaining + 0.005) throw new Error("El pago excede el saldo pendiente");

      const newPaid = document.amount_paid + amount;
      const newBalance = document.total_amount - newPaid;
      const newStatus = newBalance <= 0.005 ? "paid" : "partial";

      const { error } = await supabase
        .from("ap_ar_documents")
        .update({
          amount_paid: Math.round(newPaid * 100) / 100,
          balance_remaining: Math.max(0, Math.round(newBalance * 100) / 100),
          status: newStatus,
        })
        .eq("id", document.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      toast.success("Pago registrado");
      onOpenChange(false);
      setPaymentAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) setPaymentAmount("");
    onOpenChange(isOpen);
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            {document.contact_name} — {document.document_number || "Sin número"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Total:</span>
              <span className="ml-2 font-mono font-medium">{formatCurrency(document.total_amount, document.currency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pagado:</span>
              <span className="ml-2 font-mono font-medium">{formatCurrency(document.amount_paid, document.currency)}</span>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30 text-center">
            <div className="text-xs text-muted-foreground">Saldo Pendiente</div>
            <div className="text-lg font-bold font-mono text-destructive">
              {formatCurrency(document.balance_remaining, document.currency)}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Fecha del Pago</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Monto del Pago *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={document.balance_remaining}
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono text-lg"
              autoFocus
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => setPaymentAmount(document.balance_remaining.toFixed(2))}
            >
              Pagar total: {formatCurrency(document.balance_remaining, document.currency)}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || mutation.isPending}
          >
            {mutation.isPending ? "Guardando..." : "Registrar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
