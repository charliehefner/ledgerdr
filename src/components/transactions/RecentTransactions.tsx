import { useQuery } from '@tanstack/react-query';
import { fetchRecentTransactions, Transaction } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentTransactionsProps {
  refreshKey?: number;
}

export function RecentTransactions({ refreshKey }: RecentTransactionsProps) {
  const { data: transactions, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['recentTransactions', refreshKey],
    queryFn: () => fetchRecentTransactions(20),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load recent transactions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Transactions</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions && transactions.length > 0 ? (
                transactions.map((tx: Transaction, index: number) => (
                  <TableRow key={tx.id || index}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(tx.transaction_date)}
                    </TableCell>
                    <TableCell className="font-mono">{tx.master_acct_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.itbis ? formatCurrency(tx.itbis, tx.currency) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No recent transactions
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
