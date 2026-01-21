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
import { fetchRecentTransactions, fetchAccounts } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { AttachmentCell } from './AttachmentCell';

interface RecentTransactionsProps {
  refreshKey?: number;
}

export function RecentTransactions({ refreshKey }: RecentTransactionsProps) {
  const { getDescription } = useLanguage();
  const queryClient = useQueryClient();

  const handleAttachmentUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
  };

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['recentTransactions', refreshKey],
    queryFn: () => fetchRecentTransactions(20),
  });

  // Filter out voided transactions
  const transactions = allTransactions.filter(tx => !tx.is_void);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    return account ? getDescription(account) : code;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Date</TableHead>
                <TableHead className="w-48">Account</TableHead>
                <TableHead className="w-20">Currency</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-28">Pay Method</TableHead>
                <TableHead className="w-32">Document</TableHead>
                <TableHead className="w-16 text-center">Attach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
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
                    className={tx.is_void ? "opacity-50 bg-muted/30" : ""}
                  >
                    <TableCell className="font-mono text-sm">
                      {formatDate(tx.transaction_date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono font-medium">{tx.master_acct_code || "-"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {tx.master_acct_code ? getAccountDescription(tx.master_acct_code) : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell>{tx.pay_method || "-"}</TableCell>
                    <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>
                    <TableCell className="text-center">
                      {tx.id ? (
                        <AttachmentCell
                          transactionId={tx.id}
                          attachmentUrl={tx.attachment_url}
                          onUpdate={handleAttachmentUpdate}
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No transactions yet. Add your first transaction above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
