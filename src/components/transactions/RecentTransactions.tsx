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
import { getTransactionEdits } from '@/lib/transactionEdits';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { AttachmentCell } from './AttachmentCell';
import { EditTransactionDialog } from '@/components/invoices/EditTransactionDialog';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnSelector } from '@/components/ui/column-selector';

const RECENT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "Fecha", defaultVisible: true },
  { key: "account", label: "Cuenta", defaultVisible: true },
  { key: "project", label: "Proyecto", defaultVisible: false },
  { key: "cbsCode", label: "Código CBS", defaultVisible: false },
  { key: "purchaseDate", label: "Fecha Compra", defaultVisible: false },
  { key: "description", label: "Descripción", defaultVisible: false },
  { key: "currency", label: "Moneda", defaultVisible: true },
  { key: "amount", label: "Monto", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Método Pago", defaultVisible: true },
  { key: "document", label: "Documento", defaultVisible: true },
  { key: "name", label: "Nombre", defaultVisible: false },
  { key: "comments", label: "Comentarios", defaultVisible: false },
  { key: "exchangeRate", label: "Tasa Cambio", defaultVisible: false },
  { key: "attach", label: "Adjunto", defaultVisible: true },
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
    queryClient.invalidateQueries({ queryKey: ['transactionEdits'] });
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

  // Fetch local edits for transactions
  const { data: edits = {} } = useQuery({
    queryKey: ['transactionEdits', transactionIds],
    queryFn: () => getTransactionEdits(transactionIds),
    enabled: transactionIds.length > 0,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
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

  // Apply edits to transactions for display
  const mergedTransactions = transactions.map(mergeWithEdits);

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    return account ? getDescription(account) : code;
  };

  const visibleCount = columnVisibility.visibleColumns.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Transacciones Recientes</CardTitle>
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
                {columnVisibility.isVisible("id") && <TableHead>ID</TableHead>}
                {columnVisibility.isVisible("date") && <TableHead>Fecha</TableHead>}
                {columnVisibility.isVisible("account") && <TableHead>Cuenta</TableHead>}
                {columnVisibility.isVisible("description") && <TableHead>Descripción</TableHead>}
                {columnVisibility.isVisible("currency") && <TableHead>Moneda</TableHead>}
                {columnVisibility.isVisible("amount") && <TableHead className="text-right">Monto</TableHead>}
                {columnVisibility.isVisible("payMethod") && <TableHead>Método Pago</TableHead>}
                {columnVisibility.isVisible("document") && <TableHead>Documento</TableHead>}
                {columnVisibility.isVisible("name") && <TableHead>Nombre</TableHead>}
                {columnVisibility.isVisible("attach") && <TableHead className="text-center">Adjunto</TableHead>}
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
              ) : mergedTransactions.length > 0 ? (
                mergedTransactions.map((tx, index) => (
                  <TableRow 
                    key={tx.id || index}
                    className={`cursor-pointer hover:bg-muted/50 ${tx.is_void ? "opacity-50 bg-muted/30" : ""}`}
                    onClick={() => handleRowClick(tx)}
                  >
                    {columnVisibility.isVisible("id") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.id || "-"}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("date") && (
                      <TableCell className="font-mono text-sm whitespace-nowrap">
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
                    No hay transacciones aún. Agregue su primera transacción arriba.
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
