import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRecentTransactions, fetchAccounts, Transaction } from '@/lib/api';
import { getAttachmentUrls } from '@/lib/attachments';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { AttachmentCell } from './AttachmentCell';
import { EditTransactionDialog } from '@/components/invoices/EditTransactionDialog';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnSelector } from '@/components/ui/column-selector';

const RECENT_COLUMNS: ColumnConfig[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "account", label: "Account", defaultVisible: true },
  { key: "project", label: "Project", defaultVisible: false },
  { key: "cbsCode", label: "CBS Code", defaultVisible: false },
  { key: "purchaseDate", label: "Purchase Date", defaultVisible: false },
  { key: "description", label: "Description", defaultVisible: false },
  { key: "currency", label: "Currency", defaultVisible: true },
  { key: "amount", label: "Amount", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Pay Method", defaultVisible: true },
  { key: "document", label: "Document", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: false },
  { key: "comments", label: "Comments", defaultVisible: false },
  { key: "exchangeRate", label: "Exchange Rate", defaultVisible: false },
  { key: "attach", label: "Attach", defaultVisible: true },
];

interface RecentTransactionsProps {
  refreshKey?: number;
}

export function RecentTransactions({ refreshKey }: RecentTransactionsProps) {
  const { getDescription } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const columnVisibility = useColumnVisibility("recent-transactions", RECENT_COLUMNS);

  const handleAttachmentUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['transactionAttachments'] });
  };

  const handleRowClick = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setEditDialogOpen(true);
  };

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['recentTransactions', refreshKey],
    queryFn: () => fetchRecentTransactions(20),
  });

  // Filter out voided transactions
  const transactions = allTransactions.filter(tx => !tx.is_void);

  // Get transaction IDs to fetch attachments
  const transactionIds = transactions.map(tx => tx.id).filter(Boolean) as string[];

  // Fetch attachments from local database
  const { data: attachments = {} } = useQuery({
    queryKey: ['transactionAttachments', transactionIds],
    queryFn: () => getAttachmentUrls(transactionIds),
    enabled: transactionIds.length > 0,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    return account ? getDescription(account) : code;
  };

  const visibleCount = columnVisibility.visibleColumns.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Recent Transactions</CardTitle>
        <ColumnSelector
          columns={columnVisibility.allColumns}
          visibility={columnVisibility.visibility}
          onToggle={columnVisibility.toggleColumn}
          onReset={columnVisibility.resetToDefaults}
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columnVisibility.isVisible("date") && <TableHead className="w-24">Date</TableHead>}
                {columnVisibility.isVisible("account") && <TableHead className="w-48">Account</TableHead>}
                {columnVisibility.isVisible("description") && <TableHead className="w-48">Description</TableHead>}
                {columnVisibility.isVisible("currency") && <TableHead className="w-20">Currency</TableHead>}
                {columnVisibility.isVisible("amount") && <TableHead className="w-28 text-right">Amount</TableHead>}
                {columnVisibility.isVisible("payMethod") && <TableHead className="w-28">Pay Method</TableHead>}
                {columnVisibility.isVisible("document") && <TableHead className="w-32">Document</TableHead>}
                {columnVisibility.isVisible("name") && <TableHead className="w-32">Name</TableHead>}
                {columnVisibility.isVisible("attach") && <TableHead className="w-16 text-center">Attach</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(visibleCount)].map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx, index) => (
                  <TableRow 
                    key={tx.id || index}
                    className={`cursor-pointer hover:bg-muted/50 ${tx.is_void ? "opacity-50 bg-muted/30" : ""}`}
                    onClick={() => handleRowClick(tx)}
                  >
                    {columnVisibility.isVisible("date") && (
                      <TableCell className="font-mono text-sm">
                        {formatDate(tx.transaction_date)}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("account") && (
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{tx.master_acct_code || "-"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {tx.master_acct_code ? getAccountDescription(tx.master_acct_code) : ""}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("description") && (
                      <TableCell className="max-w-[200px] truncate">{tx.description || "-"}</TableCell>
                    )}
                    {columnVisibility.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                    {columnVisibility.isVisible("amount") && (
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("payMethod") && <TableCell>{tx.pay_method || "-"}</TableCell>}
                    {columnVisibility.isVisible("document") && (
                      <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>
                    )}
                    {columnVisibility.isVisible("name") && (
                      <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>
                    )}
                    {columnVisibility.isVisible("attach") && (
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
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleCount} className="text-center text-muted-foreground py-8">
                    No transactions yet. Add your first transaction above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </Card>
  );
}
