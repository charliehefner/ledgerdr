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
import { PlusCircle, Filter, Search, ArrowRightLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { EditTransactionDialog } from "@/components/invoices/EditTransactionDialog";

export default function Invoices() {
  const { getDescription } = useLanguage();
  const { canModifySettings } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">ITBIS</TableHead>
                    <TableHead>Pay Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(9)].map((_, j) => (
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
                        <TableCell className="font-mono">{tx.project_code || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell>{tx.name || "-"}</TableCell>
                        <TableCell>{tx.currency}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {tx.itbis ? formatCurrency(tx.itbis, tx.currency) : "-"}
                        </TableCell>
                        <TableCell>{tx.pay_method || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
