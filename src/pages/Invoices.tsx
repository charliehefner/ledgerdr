import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { fetchRecentTransactions, fetchAccounts, Transaction } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Search, ArrowRightLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { EditTransactionDialog } from "@/components/invoices/EditTransactionDialog";
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";
import { ColumnSelector } from "@/components/ui/column-selector";

const INVOICE_COLUMNS: ColumnConfig[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "account", label: "Account", defaultVisible: true },
  { key: "project", label: "Project", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "currency", label: "Currency", defaultVisible: true },
  { key: "amount", label: "Amount", defaultVisible: true },
  { key: "itbis", label: "ITBIS", defaultVisible: true },
  { key: "payMethod", label: "Pay Method", defaultVisible: true },
  { key: "document", label: "Document", defaultVisible: false },
];

export default function Invoices() {
  const { getDescription } = useLanguage();
  const { canModifySettings } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const columnVisibility = useColumnVisibility("invoices-table", INVOICE_COLUMNS);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['invoiceTransactions'],
    queryFn: () => fetchRecentTransactions(100),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  // Get unique accounts from active transactions only
  const activeForAccounts = transactions.filter((t) => !t.is_void);
  const usedAccounts = [...new Set(activeForAccounts.map((t) => t.master_acct_code).filter(Boolean))];

  // Filter transactions (exclude voided)
  const activeTransactions = transactions.filter((tx) => !tx.is_void);

  const filteredTransactions = activeTransactions.filter((tx) => {
    const matchesSearch =
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.master_acct_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.document?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAccount = accountFilter === "all" || tx.master_acct_code === accountFilter;
    const matchesCurrency = currencyFilter === "all" || tx.currency === currencyFilter;

    return matchesSearch && matchesAccount && matchesCurrency;
  });

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    return account ? getDescription(account) : code;
  };

  const visibleCount = columnVisibility.visibleColumns.length;

  return (
    <MainLayout 
      title="Invoices" 
      subtitle={`${filteredTransactions.length} transactions found`}
      actions={
        <Button asChild>
          <Link to="/transactions">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by description, name, account, or document..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Account Filter */}
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  <SelectItem value="all">All Accounts</SelectItem>
                  {usedAccounts.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Currency Filter */}
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Currencies</SelectItem>
                  <SelectItem value="DOP">DOP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>

              {/* Column Selector */}
              <ColumnSelector
                columns={columnVisibility.allColumns}
                visibility={columnVisibility.visibility}
                onToggle={columnVisibility.toggleColumn}
                onReset={columnVisibility.resetToDefaults}
              />
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columnVisibility.isVisible("date") && <TableHead>Date</TableHead>}
                    {columnVisibility.isVisible("account") && <TableHead>Account</TableHead>}
                    {columnVisibility.isVisible("project") && <TableHead>Project</TableHead>}
                    {columnVisibility.isVisible("description") && <TableHead>Description</TableHead>}
                    {columnVisibility.isVisible("name") && <TableHead>Name</TableHead>}
                    {columnVisibility.isVisible("currency") && <TableHead>Currency</TableHead>}
                    {columnVisibility.isVisible("amount") && <TableHead className="text-right">Amount</TableHead>}
                    {columnVisibility.isVisible("itbis") && <TableHead className="text-right">ITBIS</TableHead>}
                    {columnVisibility.isVisible("payMethod") && <TableHead>Pay Method</TableHead>}
                    {columnVisibility.isVisible("document") && <TableHead>Document</TableHead>}
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
                  ) : filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx, index) => (
                      <TableRow 
                        key={tx.id || index}
                        className={canModifySettings ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => {
                          if (canModifySettings && tx.id) {
                            setSelectedTransaction(tx);
                            setEditDialogOpen(true);
                          }
                        }}
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
                        {columnVisibility.isVisible("project") && (
                          <TableCell className="font-mono">{tx.project_code || "-"}</TableCell>
                        )}
                        {columnVisibility.isVisible("description") && (
                          <TableCell className="max-w-[200px] truncate">
                            {tx.description || "-"}
                          </TableCell>
                        )}
                        {columnVisibility.isVisible("name") && <TableCell>{tx.name || "-"}</TableCell>}
                        {columnVisibility.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                        {columnVisibility.isVisible("amount") && (
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(tx.amount, tx.currency)}
                          </TableCell>
                        )}
                        {columnVisibility.isVisible("itbis") && (
                          <TableCell className="text-right font-mono">
                            {tx.itbis ? formatCurrency(tx.itbis, tx.currency) : "-"}
                          </TableCell>
                        )}
                        {columnVisibility.isVisible("payMethod") && <TableCell>{tx.pay_method || "-"}</TableCell>}
                        {columnVisibility.isVisible("document") && (
                          <TableCell className="truncate max-w-[120px]">{tx.document || "-"}</TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </MainLayout>
  );
}
