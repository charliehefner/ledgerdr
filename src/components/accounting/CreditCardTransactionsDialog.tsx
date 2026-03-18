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
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  cardId: string | null;
  cardName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreditCardTransactionsDialog({ cardId, cardName, open, onOpenChange }: Props) {
  const { t } = useLanguage();
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
          <DialogTitle>{t("treasury.ccTx.title").replace("{name}", cardName)}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">{t("treasury.ccTx.loading")}</div>
        ) : transactions.length === 0 ? (
          <EmptyState icon={Receipt} title={t("treasury.ccTx.emptyTitle")} description={t("treasury.ccTx.emptyDesc")} />
        ) : (
          <div className="border rounded-lg overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>{t("treasury.ccTx.col.date")}</TableHead>
                  <TableHead>{t("treasury.ccTx.col.description")}</TableHead>
                  <TableHead>{t("treasury.ccTx.col.name")}</TableHead>
                  <TableHead className="text-right">{t("treasury.ccTx.col.amount")}</TableHead>
                  <TableHead>{t("treasury.ccTx.col.currency")}</TableHead>
                  <TableHead>{t("treasury.ccTx.col.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: any) => {
                  const isCharge = tx.pay_method === cardId;
                  return (
                    <TableRow key={tx.id} className={tx.is_void ? "opacity-50" : ""}>
                      <TableCell>
                        {isCharge ? (
                          <ArrowUp className="h-4 w-4 text-destructive" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-primary" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.description || "—"}</TableCell>
                      <TableCell>{tx.name || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(Number(tx.amount || 0))}</TableCell>
                      <TableCell>{tx.currency || "DOP"}</TableCell>
                      <TableCell>
                        {tx.is_void ? (
                          <Badge variant="destructive">{t("treasury.ccTx.voided")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("treasury.ccTx.activeStatus")}</Badge>
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
