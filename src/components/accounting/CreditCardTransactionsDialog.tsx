import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatMoney } from "@/lib/formatters";
import { Receipt, ArrowDown, ArrowUp } from "lucide-react";

type Props = {
  cardId: string | null;
  cardName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreditCardTransactionsDialog({ cardId, cardName, open, onOpenChange }: Props) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["credit-card-transactions", cardId],
    enabled: open && !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, legacy_id, transaction_date, description, amount, currency, name, is_void, pay_method, destination_acct_code")
        .or(`pay_method.eq.${cardId},destination_acct_code.eq.${cardId}`)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Movimientos — {cardName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : transactions.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin movimientos" description="No hay transacciones registradas para esta tarjeta." />
        ) : (
          <div className="border rounded-lg overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: any) => {
                  const isCharge = tx.pay_method === cardId;
                  return (
                    <TableRow key={tx.id} className={tx.is_void ? "opacity-50" : ""}>
                      <TableCell>
                        {isCharge ? (
                          <ArrowUp className="h-4 w-4 text-destructive" title="Cargo" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-green-600" title="Pago/Abono" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.description || "—"}</TableCell>
                      <TableCell>{tx.name || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(Number(tx.amount || 0))}</TableCell>
                      <TableCell>{tx.currency || "DOP"}</TableCell>
                      <TableCell>
                        {tx.is_void ? (
                          <Badge variant="destructive">Anulada</Badge>
                        ) : (
                          <Badge variant="outline">Activa</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
