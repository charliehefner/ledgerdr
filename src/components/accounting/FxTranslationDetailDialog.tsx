import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/formatters";

export interface FxTranslationRow {
  account_id: string;
  account_code: string;
  account_name: string;
  usd_balance: number;
  book_dop_balance: number;
  reported_dop_balance: number;
  fx_impact: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: FxTranslationRow[];
  closingRate: number;
  asOfDate: string;
}

export function FxTranslationDetailDialog({ open, onOpenChange, rows, closingRate, asOfDate }: Props) {
  const { t } = useLanguage();
  const totalImpact = rows.reduce((s, r) => s + (r.fx_impact || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("fx.translationGainLoss")}</DialogTitle>
          <DialogDescription>
            {t("fx.translationBreakdown")} — {asOfDate} @ {closingRate.toFixed(2)} DOP/USD
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{t("acctReport.col.account")}</TableHead>
                <TableHead>{t("acctReport.col.description")}</TableHead>
                <TableHead className="text-right">{t("fx.col.usdBalance")}</TableHead>
                <TableHead className="text-right">{t("fx.col.bookDop")}</TableHead>
                <TableHead className="text-right">{t("fx.col.reportedDop")}</TableHead>
                <TableHead className="text-right">{t("fx.col.fxImpact")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    —
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.account_id}>
                    <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                    <TableCell>{r.account_name}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(r.usd_balance, "USD")}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(r.book_dop_balance, "DOP")}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(r.reported_dop_balance, "DOP")}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${r.fx_impact < 0 ? "text-destructive" : "text-primary"}`}>
                      {formatCurrency(r.fx_impact, "DOP")}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {rows.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5} className="text-right">{t("common.total") || "Total"}</TableCell>
                  <TableCell className={`text-right font-mono ${totalImpact < 0 ? "text-destructive" : "text-primary"}`}>
                    {formatCurrency(totalImpact, "DOP")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
