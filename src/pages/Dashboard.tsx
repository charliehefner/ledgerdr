import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchRecentTransactions, fetchAccounts, Transaction } from "@/lib/api";
import { getAllAttachmentUrls, AttachmentCategory } from "@/lib/attachments";
import { getDescription } from "@/lib/getDescription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColumnSelector } from "@/components/ui/column-selector";
import { EditTransactionDialog } from "@/components/invoices/EditTransactionDialog";
import { MultiAttachmentCell } from "@/components/transactions/MultiAttachmentCell";
import { FiscalDocumentsReport } from "@/components/dashboard/FiscalDocumentsReport";
import { useLanguage } from "@/contexts/LanguageContext";
import { DASHBOARD_COLUMNS } from "@/components/transactions/columnConfig";

// Helper to check if a transaction is Nomina (payroll)
const isNominaTransaction = (tx: Transaction): boolean => {
  // Check account code 7010 (Nomina) or description contains "Nomina"
  return tx.master_acct_code === '7010' || 
         (tx.description?.toLowerCase().includes('nomina') ?? false);
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { t, language } = useLanguage();
  
  const pendingNcfColumns = useColumnVisibility("dashboard-pending-ncf", DASHBOARD_COLUMNS);
  const withoutPaymentReceiptColumns = useColumnVisibility("dashboard-without-payment-receipt", DASHBOARD_COLUMNS);

  // Fetch ALL transactions for pending document/attachment checks
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['allTransactions'],
    queryFn: () => fetchRecentTransactions(1000), // Fetch all to ensure no pending items are missed
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  // Get transaction IDs for attachment lookup
  const transactionIds = allTransactions
    .filter(tx => !tx.is_void && tx.id)
    .map(tx => tx.id as string);

  // Fetch all attachments for all transactions (with categories)
  const { data: allAttachments = {} } = useQuery({
    queryKey: ['dashboardAllAttachments', transactionIds],
    queryFn: () => getAllAttachmentUrls(transactionIds),
    enabled: transactionIds.length > 0,
  });

  // Filter: non-voided transactions without a document field
  // Exclude internal transactions (they don't require documents)
  const transactionsWithoutDocument = allTransactions
    .filter(tx => !tx.is_void)
    .filter(tx => !tx.is_internal)
    .filter(tx => !tx.document || tx.document.trim() === '');

  // Filter: non-voided transactions without NCF attachment
  // Exclude Nomina transactions and internal transactions as they don't require attachments
  const transactionsWithoutNcfAttachment = allTransactions
    .filter(tx => !tx.is_void && tx.id)
    .filter(tx => !isNominaTransaction(tx))
    .filter(tx => !tx.is_internal)
    .filter(tx => {
      const attachments = allAttachments[String(tx.id)];
      // Transaction is resolved if it has an NCF attachment
      const hasNcf = !!attachments?.ncf;
      return !hasNcf;
    });

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    if (!account) return code;
    return getDescription(account, language);
  };

  const visibleNcfCount = pendingNcfColumns.visibleColumns.length;
  const visiblePaymentReceiptCount = withoutPaymentReceiptColumns.visibleColumns.length;

  const handleRowClick = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setEditDialogOpen(true);
  };

  const handleAttachmentUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardAllAttachments'] });
  };

  // Get attachments for a transaction, defaulting to empty if not found
  const getAttachmentsForTransaction = (txId: string): Record<AttachmentCategory, string | null> => {
    return allAttachments[txId] || { ncf: null, payment_receipt: null, quote: null };
  };

  return (
    <MainLayout title={t("page.dashboard.title")} subtitle={t("page.dashboard.subtitle")}>
      <div className="space-y-6 animate-fade-in">
        {/* Fiscal Documents Report */}
        <FiscalDocumentsReport />

        {/* Transactions Without Document (NCF) */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="font-semibold">{t("dashboard.pendingNcf")}</h3>
              <p className="text-sm text-muted-foreground">{t("dashboard.pendingNcfSubtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={pendingNcfColumns.allColumns}
                visibility={pendingNcfColumns.visibility}
                onToggle={pendingNcfColumns.toggleColumn}
                onReset={pendingNcfColumns.resetToDefaults}
              />
              <Button variant="outline" asChild>
                <Link to="/transactions">
                  {t("common.viewAll")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {pendingNcfColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {pendingNcfColumns.isVisible("date") && <TableHead>{t("col.date")}</TableHead>}
                {pendingNcfColumns.isVisible("account") && <TableHead>{t("col.account")}</TableHead>}
                {pendingNcfColumns.isVisible("description") && <TableHead>{t("common.description")}</TableHead>}
                {pendingNcfColumns.isVisible("document") && <TableHead>{t("col.document")}</TableHead>}
                {pendingNcfColumns.isVisible("name") && <TableHead>{t("common.name")}</TableHead>}
                {pendingNcfColumns.isVisible("currency") && <TableHead>{t("col.currency")}</TableHead>}
                {pendingNcfColumns.isVisible("amount") && <TableHead className="text-right">{t("common.amount")}</TableHead>}
                {pendingNcfColumns.isVisible("attach") && <TableHead className="text-center">{t("col.attachment")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleNcfCount} className="text-center py-8 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutDocument.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleNcfCount} className="text-center py-8 text-muted-foreground">
                    {t("dashboard.allDocsAttached")}
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutDocument.map((tx) => (
                  <TableRow 
                    key={tx.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(tx)}
                  >
                    {pendingNcfColumns.isVisible("id") && <TableCell className="font-mono text-xs text-muted-foreground">{tx.id || "-"}</TableCell>}
                    {pendingNcfColumns.isVisible("date") && <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>}
                    {pendingNcfColumns.isVisible("account") && (
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{tx.master_acct_code || "-"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {tx.master_acct_code ? getAccountDescription(tx.master_acct_code) : ""}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    {pendingNcfColumns.isVisible("description") && <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>}
                    {pendingNcfColumns.isVisible("document") && <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>}
                    {pendingNcfColumns.isVisible("name") && <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>}
                    {pendingNcfColumns.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                    {pendingNcfColumns.isVisible("amount") && <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>}
                    {pendingNcfColumns.isVisible("attach") && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {tx.id ? (
                          <MultiAttachmentCell
                            transactionId={tx.id}
                            attachments={getAttachmentsForTransaction(String(tx.id))}
                            onUpdate={handleAttachmentUpdate}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Transactions Without Payment Receipt */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="font-semibold">{t("dashboard.noPaymentReceipt")}</h3>
              <p className="text-sm text-muted-foreground">{t("dashboard.noPaymentReceiptSubtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={withoutPaymentReceiptColumns.allColumns}
                visibility={withoutPaymentReceiptColumns.visibility}
                onToggle={withoutPaymentReceiptColumns.toggleColumn}
                onReset={withoutPaymentReceiptColumns.resetToDefaults}
              />
              <Button variant="outline" asChild>
                <Link to="/transactions">
                  {t("common.viewAll")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {withoutPaymentReceiptColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("date") && <TableHead>{t("col.date")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("account") && <TableHead>{t("col.account")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("description") && <TableHead>{t("common.description")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("document") && <TableHead>{t("col.document")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("name") && <TableHead>{t("common.name")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("currency") && <TableHead>{t("col.currency")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("amount") && <TableHead className="text-right">{t("common.amount")}</TableHead>}
                {withoutPaymentReceiptColumns.isVisible("attach") && <TableHead className="text-center">{t("col.attachment")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visiblePaymentReceiptCount} className="text-center py-8 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutNcfAttachment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visiblePaymentReceiptCount} className="text-center py-8 text-muted-foreground">
                    {t("dashboard.allNcfAttachments")}
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutNcfAttachment.map((tx) => (
                  <TableRow 
                    key={tx.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(tx)}
                  >
                    {withoutPaymentReceiptColumns.isVisible("id") && <TableCell className="font-mono text-xs text-muted-foreground">{tx.id || "-"}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("date") && <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("account") && (
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{tx.master_acct_code || "-"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {tx.master_acct_code ? getAccountDescription(tx.master_acct_code) : ""}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    {withoutPaymentReceiptColumns.isVisible("description") && <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("document") && <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("name") && <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("amount") && <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>}
                    {withoutPaymentReceiptColumns.isVisible("attach") && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {tx.id ? (
                          <MultiAttachmentCell
                            transactionId={tx.id}
                            attachments={getAttachmentsForTransaction(String(tx.id))}
                            onUpdate={handleAttachmentUpdate}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </MainLayout>
  );
}
