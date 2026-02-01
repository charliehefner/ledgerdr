import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchRecentTransactions, fetchAccounts, Transaction } from "@/lib/api";
import { getAttachmentUrls } from "@/lib/attachments";
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
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";
import { ColumnSelector } from "@/components/ui/column-selector";
import { EditTransactionDialog } from "@/components/invoices/EditTransactionDialog";
import { AttachmentCell } from "@/components/transactions/AttachmentCell";
import { FiscalDocumentsReport } from "@/components/dashboard/FiscalDocumentsReport";
import { useLanguage } from "@/contexts/LanguageContext";

// Column configs will use translation keys
const PENDING_NCF_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "col.date", defaultVisible: true },
  { key: "account", label: "col.account", defaultVisible: true },
  { key: "project", label: "col.project", defaultVisible: false },
  { key: "cbsCode", label: "col.cbsCode", defaultVisible: false },
  { key: "purchaseDate", label: "col.purchaseDate", defaultVisible: false },
  { key: "description", label: "common.description", defaultVisible: true },
  { key: "currency", label: "col.currency", defaultVisible: true },
  { key: "amount", label: "common.amount", defaultVisible: true },
  { key: "itbis", label: "col.itbis", defaultVisible: false },
  { key: "payMethod", label: "col.payMethod", defaultVisible: false },
  { key: "document", label: "col.document", defaultVisible: true },
  { key: "name", label: "common.name", defaultVisible: false },
  { key: "comments", label: "col.comments", defaultVisible: false },
  { key: "exchangeRate", label: "col.exchangeRate", defaultVisible: false },
  { key: "attach", label: "col.attachment", defaultVisible: true },
];

const WITHOUT_ATTACHMENT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "col.date", defaultVisible: true },
  { key: "account", label: "col.account", defaultVisible: true },
  { key: "project", label: "col.project", defaultVisible: false },
  { key: "cbsCode", label: "col.cbsCode", defaultVisible: false },
  { key: "purchaseDate", label: "col.purchaseDate", defaultVisible: false },
  { key: "description", label: "common.description", defaultVisible: true },
  { key: "currency", label: "col.currency", defaultVisible: true },
  { key: "amount", label: "common.amount", defaultVisible: true },
  { key: "itbis", label: "col.itbis", defaultVisible: false },
  { key: "payMethod", label: "col.payMethod", defaultVisible: false },
  { key: "document", label: "col.document", defaultVisible: true },
  { key: "name", label: "common.name", defaultVisible: false },
  { key: "comments", label: "col.comments", defaultVisible: false },
  { key: "exchangeRate", label: "col.exchangeRate", defaultVisible: false },
  { key: "attach", label: "col.attachment", defaultVisible: true },
];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { t, language } = useLanguage();
  
  const pendingNcfColumns = useColumnVisibility("dashboard-pending-ncf", PENDING_NCF_COLUMNS);
  const withoutAttachmentColumns = useColumnVisibility("dashboard-without-attachment", WITHOUT_ATTACHMENT_COLUMNS);

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

  // Fetch attachments for all transactions
  const { data: attachments = {} } = useQuery({
    queryKey: ['dashboardAttachments', transactionIds],
    queryFn: () => getAttachmentUrls(transactionIds),
    enabled: transactionIds.length > 0,
  });

  // Filter: non-voided transactions without a document field
  const transactionsWithoutDocument = allTransactions
    .filter(tx => !tx.is_void)
    .filter(tx => !tx.document || tx.document.trim() === '');

  // Filter: non-voided transactions without a physical attachment
  // Exclude account 7010 (Nomina) as these don't require attachments
  const transactionsWithoutAttachment = allTransactions
    .filter(tx => !tx.is_void && tx.id && !attachments[tx.id] && tx.master_acct_code !== '7010');

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    if (!account) return code;
    return getDescription(account, language);
  };

  const visibleNcfCount = pendingNcfColumns.visibleColumns.length;
  const visibleAttachCount = withoutAttachmentColumns.visibleColumns.length;

  const handleRowClick = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setEditDialogOpen(true);
  };

  const handleAttachmentUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardAttachments'] });
  };

  return (
    <MainLayout title={t("page.dashboard.title")} subtitle={t("page.dashboard.subtitle")}>
      <div className="space-y-6 animate-fade-in">
        {/* Fiscal Documents Report */}
        <FiscalDocumentsReport />

        {/* Transactions Without Document */}
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
                          <AttachmentCell
                            transactionId={tx.id}
                            attachmentUrl={attachments[String(tx.id)] || null}
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

        {/* Transactions Without Physical Attachment */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="font-semibold">{t("dashboard.noAttachment")}</h3>
              <p className="text-sm text-muted-foreground">{t("dashboard.noAttachmentSubtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={withoutAttachmentColumns.allColumns}
                visibility={withoutAttachmentColumns.visibility}
                onToggle={withoutAttachmentColumns.toggleColumn}
                onReset={withoutAttachmentColumns.resetToDefaults}
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
                {withoutAttachmentColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {withoutAttachmentColumns.isVisible("date") && <TableHead>{t("col.date")}</TableHead>}
                {withoutAttachmentColumns.isVisible("account") && <TableHead>{t("col.account")}</TableHead>}
                {withoutAttachmentColumns.isVisible("description") && <TableHead>{t("common.description")}</TableHead>}
                {withoutAttachmentColumns.isVisible("document") && <TableHead>{t("col.document")}</TableHead>}
                {withoutAttachmentColumns.isVisible("name") && <TableHead>{t("common.name")}</TableHead>}
                {withoutAttachmentColumns.isVisible("currency") && <TableHead>{t("col.currency")}</TableHead>}
                {withoutAttachmentColumns.isVisible("amount") && <TableHead className="text-right">{t("common.amount")}</TableHead>}
                {withoutAttachmentColumns.isVisible("attach") && <TableHead className="text-center">{t("col.attachment")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleAttachCount} className="text-center py-8 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutAttachment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleAttachCount} className="text-center py-8 text-muted-foreground">
                    {t("dashboard.allAttached")}
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutAttachment.map((tx) => (
                  <TableRow 
                    key={tx.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(tx)}
                  >
                    {withoutAttachmentColumns.isVisible("id") && <TableCell className="font-mono text-xs text-muted-foreground">{tx.id || "-"}</TableCell>}
                    {withoutAttachmentColumns.isVisible("date") && <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>}
                    {withoutAttachmentColumns.isVisible("account") && (
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{tx.master_acct_code || "-"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {tx.master_acct_code ? getAccountDescription(tx.master_acct_code) : ""}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    {withoutAttachmentColumns.isVisible("description") && <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>}
                    {withoutAttachmentColumns.isVisible("document") && <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>}
                    {withoutAttachmentColumns.isVisible("name") && <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>}
                    {withoutAttachmentColumns.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                    {withoutAttachmentColumns.isVisible("amount") && <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>}
                    {withoutAttachmentColumns.isVisible("attach") && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {tx.id ? (
                          <AttachmentCell
                            transactionId={tx.id}
                            attachmentUrl={attachments[String(tx.id)] || null}
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
