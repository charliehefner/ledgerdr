import { MainLayout } from "@/components/layout/MainLayout";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchRecentTransactions, fetchAccounts } from "@/lib/api";
import { getAttachmentUrls } from "@/lib/attachments";
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

export default function Dashboard() {
  const { getDescription } = useLanguage();

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

  // Filter: non-voided transactions without a document field
  const transactionsWithoutDocument = allTransactions
    .filter(tx => !tx.is_void && (!tx.document || tx.document.trim() === ''));

  // Filter: non-voided transactions without a physical attachment
  const transactionsWithoutAttachment = allTransactions
    .filter(tx => !tx.is_void && tx.id && !attachments[tx.id]);

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    if (!account) return code;
    return getDescription(account);
  };

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
            <Button variant="outline" asChild>
              <Link to="/transactions">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutDocument.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    All transactions have documents attached
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutDocument.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell>{getAccountDescription(tx.master_acct_code)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                    <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>
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
            <Button variant="outline" asChild>
              <Link to="/transactions">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutAttachment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    All transactions have attachments uploaded
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutAttachment.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell>{getAccountDescription(tx.master_acct_code)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                    <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>
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
