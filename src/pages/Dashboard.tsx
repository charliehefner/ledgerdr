import { MainLayout } from "@/components/layout/MainLayout";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchRecentTransactions, fetchAccounts, Transaction } from "@/lib/api";
import { getAttachmentUrls } from "@/lib/attachments";
import { getDescription } from "@/lib/getDescription";
import { useQuery } from "@tanstack/react-query";
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
  { key: "date", label: "Fecha", defaultVisible: true },
  { key: "account", label: "Cuenta", defaultVisible: true },
  { key: "project", label: "Proyecto", defaultVisible: false },
  { key: "cbsCode", label: "Código CBS", defaultVisible: false },
  { key: "purchaseDate", label: "Fecha Compra", defaultVisible: false },
  { key: "description", label: "Descripción", defaultVisible: true },
  { key: "currency", label: "Moneda", defaultVisible: true },
  { key: "amount", label: "Monto", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Método Pago", defaultVisible: false },
  { key: "document", label: "Documento", defaultVisible: true },
  { key: "name", label: "Nombre", defaultVisible: false },
  { key: "comments", label: "Comentarios", defaultVisible: false },
  { key: "exchangeRate", label: "Tasa Cambio", defaultVisible: false },
];

const WITHOUT_ATTACHMENT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", defaultVisible: true },
  { key: "date", label: "Fecha", defaultVisible: true },
  { key: "account", label: "Cuenta", defaultVisible: true },
  { key: "project", label: "Proyecto", defaultVisible: false },
  { key: "cbsCode", label: "Código CBS", defaultVisible: false },
  { key: "purchaseDate", label: "Fecha Compra", defaultVisible: false },
  { key: "description", label: "Descripción", defaultVisible: true },
  { key: "currency", label: "Moneda", defaultVisible: true },
  { key: "amount", label: "Monto", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: false },
  { key: "payMethod", label: "Método Pago", defaultVisible: false },
  { key: "document", label: "Documento", defaultVisible: true },
  { key: "name", label: "Nombre", defaultVisible: false },
  { key: "comments", label: "Comentarios", defaultVisible: false },
  { key: "exchangeRate", label: "Tasa Cambio", defaultVisible: false },
];

export default function Dashboard() {
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
    <MainLayout title="Panel" subtitle="Resumen de sus facturas de gastos">
      <div className="space-y-6 animate-fade-in">
        {/* Transactions Without Document */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="font-semibold">Transacciones Pendientes de NCF</h3>
              <p className="text-sm text-muted-foreground">Falta número de comprobante fiscal</p>
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
                  Ver Todo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {pendingNcfColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {pendingNcfColumns.isVisible("date") && <TableHead>Fecha</TableHead>}
                {pendingNcfColumns.isVisible("account") && <TableHead>Cuenta</TableHead>}
                {pendingNcfColumns.isVisible("description") && <TableHead>Descripción</TableHead>}
                {pendingNcfColumns.isVisible("document") && <TableHead>Documento</TableHead>}
                {pendingNcfColumns.isVisible("name") && <TableHead>Nombre</TableHead>}
                {pendingNcfColumns.isVisible("currency") && <TableHead>Moneda</TableHead>}
                {pendingNcfColumns.isVisible("amount") && <TableHead className="text-right">Monto</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleNcfCount} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutDocument.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleNcfCount} className="text-center py-8 text-muted-foreground">
                    Todas las transacciones tienen documentos adjuntos
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutDocument.map((tx) => (
                  <TableRow key={tx.id}>
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
              <h3 className="font-semibold">Transacciones Sin Adjunto</h3>
              <p className="text-sm text-muted-foreground">Pendiente de subir recibo/imagen</p>
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
                  Ver Todo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {withoutAttachmentColumns.isVisible("id") && <TableHead>ID</TableHead>}
                {withoutAttachmentColumns.isVisible("date") && <TableHead>Fecha</TableHead>}
                {withoutAttachmentColumns.isVisible("account") && <TableHead>Cuenta</TableHead>}
                {withoutAttachmentColumns.isVisible("description") && <TableHead>Descripción</TableHead>}
                {withoutAttachmentColumns.isVisible("document") && <TableHead>Documento</TableHead>}
                {withoutAttachmentColumns.isVisible("name") && <TableHead>Nombre</TableHead>}
                {withoutAttachmentColumns.isVisible("currency") && <TableHead>Moneda</TableHead>}
                {withoutAttachmentColumns.isVisible("amount") && <TableHead className="text-right">Monto</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleAttachCount} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutAttachment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleAttachCount} className="text-center py-8 text-muted-foreground">
                    Todas las transacciones tienen adjuntos subidos
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutAttachment.map((tx) => (
                  <TableRow key={tx.id}>
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
