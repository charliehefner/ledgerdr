import { MainLayout } from "@/components/layout/MainLayout";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchRecentTransactions, fetchAccounts, Transaction } from "@/lib/api";
import { getAttachmentUrls } from "@/lib/attachments";
import { getTransactionEdits } from "@/lib/transactionEdits";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
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

const PENDING_NCF_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "Date", defaultVisible: true },
  { key: "account", label: "Account", defaultVisible: true },
  { key: "project", label: "Project", defaultVisible: false },
  { key: "cbsCode", label: "CBS Code", defaultVisible: false },
  { key: "purchaseDate", label: "Purchase Date", defaultVisible: false },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "currency", label: "Currency", defaultVisible: true },
  { key: "amount", label: "Amount", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Pay Method", defaultVisible: false },
  { key: "document", label: "Document", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: false },
  { key: "comments", label: "Comments", defaultVisible: false },
  { key: "exchangeRate", label: "Exchange Rate", defaultVisible: false },
];

const WITHOUT_ATTACHMENT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "Date", defaultVisible: true },
  { key: "account", label: "Account", defaultVisible: true },
  { key: "project", label: "Project", defaultVisible: false },
  { key: "cbsCode", label: "CBS Code", defaultVisible: false },
  { key: "purchaseDate", label: "Purchase Date", defaultVisible: false },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "currency", label: "Currency", defaultVisible: true },
  { key: "amount", label: "Amount", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Pay Method", defaultVisible: false },
  { key: "document", label: "Document", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: false },
  { key: "comments", label: "Comments", defaultVisible: false },
  { key: "exchangeRate", label: "Exchange Rate", defaultVisible: false },
];

export default function Dashboard() {
  const { getDescription } = useLanguage();

  const pendingNcfColumns = useColumnVisibility("dashboard-pending-ncf", PENDING_NCF_COLUMNS);
  const withoutAttachmentColumns = useColumnVisibility("dashboard-without-attachment", WITHOUT_ATTACHMENT_COLUMNS);

  // Fetch transactions without documents
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: () => fetchRecentTransactions(50),
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

  // Fetch local edits for all transactions
  const { data: edits = {} } = useQuery({
    queryKey: ['transactionEdits', transactionIds],
    queryFn: () => getTransactionEdits(transactionIds),
    enabled: transactionIds.length > 0,
  });

  // Merge API data with local edits
  const mergeWithEdits = (tx: Transaction): Transaction => {
    const edit = edits[String(tx.id)];
    if (!edit) return tx;
    return {
      ...tx,
      document: edit.document ?? tx.document,
    };
  };

  // Filter: non-voided transactions without a document field (considering local edits)
  const transactionsWithoutDocument = allTransactions
    .filter(tx => !tx.is_void)
    .map(mergeWithEdits)
    .filter(tx => !tx.document || tx.document.trim() === '');

  // Filter: non-voided transactions without a physical attachment
  const transactionsWithoutAttachment = allTransactions
    .filter(tx => !tx.is_void && tx.id && !attachments[tx.id]);

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    if (!account) return code;
    return getDescription(account);
  };

  const visibleNcfCount = pendingNcfColumns.visibleColumns.length;
  const visibleAttachCount = withoutAttachmentColumns.visibleColumns.length;

  return (
    <MainLayout title="Dashboard" subtitle="Overview of your expense invoices">
      <div className="space-y-6 animate-fade-in">
        {/* Transactions Without Document */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="font-semibold">Transactions Pending NCF Number</h3>
              <p className="text-sm text-muted-foreground">Missing fiscal document number</p>
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
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {pendingNcfColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {pendingNcfColumns.isVisible("date") && <TableHead>Date</TableHead>}
                {pendingNcfColumns.isVisible("account") && <TableHead>Account</TableHead>}
                {pendingNcfColumns.isVisible("description") && <TableHead>Description</TableHead>}
                {pendingNcfColumns.isVisible("document") && <TableHead>Document</TableHead>}
                {pendingNcfColumns.isVisible("name") && <TableHead>Name</TableHead>}
                {pendingNcfColumns.isVisible("currency") && <TableHead>Currency</TableHead>}
                {pendingNcfColumns.isVisible("amount") && <TableHead className="text-right">Amount</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleNcfCount} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutDocument.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleNcfCount} className="text-center py-8 text-muted-foreground">
                    All transactions have documents attached
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutDocument.map((tx) => (
                  <TableRow key={tx.id}>
                    {pendingNcfColumns.isVisible("id") && <TableCell className="font-mono text-xs text-muted-foreground">{tx.id || "-"}</TableCell>}
                    {pendingNcfColumns.isVisible("date") && <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>}
                    {pendingNcfColumns.isVisible("account") && <TableCell>{getAccountDescription(tx.master_acct_code)}</TableCell>}
                    {pendingNcfColumns.isVisible("description") && <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>}
                    {pendingNcfColumns.isVisible("document") && <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>}
                    {pendingNcfColumns.isVisible("name") && <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>}
                    {pendingNcfColumns.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                    {pendingNcfColumns.isVisible("amount") && <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>}
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
              <h3 className="font-semibold">Transactions Without Attachment</h3>
              <p className="text-sm text-muted-foreground">Pending receipt/image upload</p>
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
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {withoutAttachmentColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {withoutAttachmentColumns.isVisible("date") && <TableHead>Date</TableHead>}
                {withoutAttachmentColumns.isVisible("account") && <TableHead>Account</TableHead>}
                {withoutAttachmentColumns.isVisible("description") && <TableHead>Description</TableHead>}
                {withoutAttachmentColumns.isVisible("document") && <TableHead>Document</TableHead>}
                {withoutAttachmentColumns.isVisible("name") && <TableHead>Name</TableHead>}
                {withoutAttachmentColumns.isVisible("currency") && <TableHead>Currency</TableHead>}
                {withoutAttachmentColumns.isVisible("amount") && <TableHead className="text-right">Amount</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleAttachCount} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutAttachment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleAttachCount} className="text-center py-8 text-muted-foreground">
                    All transactions have attachments uploaded
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutAttachment.map((tx) => (
                  <TableRow key={tx.id}>
                    {withoutAttachmentColumns.isVisible("id") && <TableCell className="font-mono text-xs text-muted-foreground">{tx.id || "-"}</TableCell>}
                    {withoutAttachmentColumns.isVisible("date") && <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>}
                    {withoutAttachmentColumns.isVisible("account") && <TableCell>{getAccountDescription(tx.master_acct_code)}</TableCell>}
                    {withoutAttachmentColumns.isVisible("description") && <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>}
                    {withoutAttachmentColumns.isVisible("document") && <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>}
                    {withoutAttachmentColumns.isVisible("name") && <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>}
                    {withoutAttachmentColumns.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                    {withoutAttachmentColumns.isVisible("amount") && <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
