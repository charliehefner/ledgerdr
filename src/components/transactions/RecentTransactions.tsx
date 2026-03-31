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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { fetchRecentTransactions, fetchAccounts, Transaction } from '@/lib/api';
import { getAllAttachmentUrls, AttachmentCategory } from '@/lib/attachments';
import { supabase } from '@/integrations/supabase/client';
import { getDescription } from '@/lib/getDescription';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { MultiAttachmentCell } from './MultiAttachmentCell';
import { EditTransactionDialog } from '@/components/invoices/EditTransactionDialog';
import { Badge } from '@/components/ui/badge';
import { useColumnVisibility } from '@/hooks/useColumnVisibility';
import { ColumnSelector } from '@/components/ui/column-selector';
import { useLanguage } from '@/contexts/LanguageContext';
import { TRANSACTION_COLUMNS } from './columnConfig';
import { usePagination } from '@/hooks/usePagination';

interface RecentTransactionsProps {
  refreshKey?: number;
}

export function RecentTransactions({ refreshKey }: RecentTransactionsProps) {
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { t, language } = useLanguage();

  const columnVisibility = useColumnVisibility("recent-transactions", TRANSACTION_COLUMNS);

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
    queryFn: () => fetchRecentTransactions(500),
  });

  const pagination = usePagination(allTransactions, { defaultPageSize: 20 });
  const transactions = pagination.pageData;

  // Use UUID for attachment lookups (transaction_attachments now uses UUID FK)
  const attachmentIds = transactions
    .map(tx => tx.id)
    .filter((id): id is string => !!id);

  // Fetch all attachments with categories from local database
  const { data: allAttachments = {} } = useQuery({
    queryKey: ['transactionAttachments', attachmentIds],
    queryFn: () => getAllAttachmentUrls(attachmentIds),
    enabled: attachmentIds.length > 0,
  });

  // Account descriptions now come from FK joins in fetchRecentTransactions
  const getAccountDescription = (tx: Transaction) => {
    if (language === 'es') {
      return tx.account_spanish_description || tx.account_english_description || tx.account_name || tx.master_acct_code || '';
    }
    return tx.account_english_description || tx.account_name || tx.master_acct_code || '';
  };

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, account_name, account_type, currency')
        .order('account_name');
      if (error) throw error;
      return data;
    },
  });

  const LEGACY_PAY_METHOD_LABELS: Record<string, string> = {
    transfer_bdi: t('txForm.transferBdi'),
    transfer_bhd: t('txForm.transferBhd'),
    cash: t('txForm.cash'),
    petty_cash: t('txForm.pettyCash'),
    cc_management: t('txForm.ccManagement'),
    cc_agri: t('txForm.ccAgri'),
    cc_industry: t('txForm.ccIndustry'),
    credit: t('txForm.credit'),
  };

  const getPayMethodLabel = (payMethod: string | null): string => {
    if (!payMethod) return '-';
    if (LEGACY_PAY_METHOD_LABELS[payMethod]) return LEGACY_PAY_METHOD_LABELS[payMethod];
    const bankAcct = bankAccounts.find(b => b.id === payMethod);
    if (bankAcct) return `${bankAcct.account_name} (${bankAcct.currency})`;
    return payMethod;
  };

  const getAttachmentsForTransaction = (txId: string): Record<AttachmentCategory, string | null> => {
    return allAttachments[txId] || { ncf: null, payment_receipt: null, quote: null };
  };

  const visibleCount = columnVisibility.visibleColumns.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{language === 'es' ? 'Transacciones Recientes' : 'Recent Transactions'}</CardTitle>
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
                {columnVisibility.isVisible("date") && <TableHead>{t("col.date")}</TableHead>}
                {columnVisibility.isVisible("dueDate") && <TableHead>{language === 'es' ? 'Fecha Venc.' : 'Due Date'}</TableHead>}
                {columnVisibility.isVisible("account") && <TableHead>{t("col.account")}</TableHead>}
                {columnVisibility.isVisible("description") && <TableHead>{t("common.description")}</TableHead>}
                {columnVisibility.isVisible("currency") && <TableHead>{t("col.currency")}</TableHead>}
                {columnVisibility.isVisible("amount") && <TableHead className="text-right">{t("common.amount")}</TableHead>}
                {columnVisibility.isVisible("payMethod") && <TableHead>{t("col.payMethod")}</TableHead>}
                {columnVisibility.isVisible("document") && <TableHead>{t("col.document")}</TableHead>}
                {columnVisibility.isVisible("name") && <TableHead>{t("common.name")}</TableHead>}
                {columnVisibility.isVisible("costCenter") && <TableHead>Centro Costo</TableHead>}
                {columnVisibility.isVisible("attach") && <TableHead className="text-center">{t("col.attachment")}</TableHead>}
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
                    {columnVisibility.isVisible("id") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.legacy_id || "-"}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("date") && (
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {formatDate(tx.transaction_date)}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("dueDate") && (
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {tx.due_date ? formatDate(tx.due_date) : "-"}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("account") && (
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{tx.master_acct_code || "-"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {tx.master_acct_code ? getAccountDescription(tx) : ""}
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
                    {columnVisibility.isVisible("payMethod") && <TableCell>{getPayMethodLabel(tx.pay_method)}</TableCell>}
                    {columnVisibility.isVisible("document") && (
                      <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>
                    )}
                    {columnVisibility.isVisible("name") && (
                      <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>
                    )}
                    {columnVisibility.isVisible("costCenter") && (
                      <TableCell>
                        {(() => {
                          const cc = (tx as any).cost_center || 'general';
                          const label = cc === 'agricultural' ? t("common.agricultural") : cc === 'industrial' ? t("common.industrial") : t("common.general");
                          const cls = cc === 'agricultural' ? 'bg-accent text-accent-foreground' : cc === 'industrial' ? 'bg-info/15 text-info' : 'bg-muted text-muted-foreground';
                          return <Badge variant="outline" className={cls}>{label}</Badge>;
                        })()}
                      </TableCell>
                    )}
                    {columnVisibility.isVisible("attach") && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {tx.id ? (
                          <MultiAttachmentCell
                            transactionId={tx.id}
                            attachments={getAttachmentsForTransaction(tx.id)}
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
                    {language === 'es' 
                      ? 'No hay transacciones aún. Agregue su primera transacción arriba.'
                      : 'No transactions yet. Add your first transaction above.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        {pagination.totalItems > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{language === 'es' ? 'Mostrar' : 'Show'}</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => pagination.setPageSize(Number(v))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pagination.pageSizeOptions.map(size => (
                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>
                {language === 'es' 
                  ? `de ${pagination.totalItems} transacciones`
                  : `of ${pagination.totalItems} transactions`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!pagination.hasPrevPage} onClick={() => pagination.setPage(0)}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!pagination.hasPrevPage} onClick={pagination.prevPage}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                {pagination.page + 1} / {pagination.totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!pagination.hasNextPage} onClick={pagination.nextPage}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!pagination.hasNextPage} onClick={() => pagination.setPage(pagination.totalPages - 1)}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </Card>
  );
}
