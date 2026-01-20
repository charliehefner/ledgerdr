import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RecentTransactionsProps {
  refreshKey?: number;
}

export function RecentTransactions({ refreshKey }: RecentTransactionsProps) {
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
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="w-20">Currency</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-24 text-right">ITBIS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No transactions yet. Add your first transaction above.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
