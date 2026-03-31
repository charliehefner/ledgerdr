import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchRecentTransactions } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import { parseDateLocal } from "@/lib/dateUtils";

const ACCOUNT_CBS_PAIRS = [
  { label: "Agrochemicals", accounts: ["4030"], cbs: "13" },
  { label: "Diesel", accounts: ["4040"], cbs: "14" },
  { label: "Fertilizer", accounts: ["4080", "4082"], cbs: "12" },
  { label: "Oil and Grease", accounts: ["4050", "4060"], cbs: "15" },
];

export function PurchaseTotalsByAccount() {
  const [period, setPeriod] = useState("current_month");

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["reportTransactions", "1000"],
    queryFn: () => fetchRecentTransactions(1000),
  });

  const nonVoidedTransactions = allTransactions.filter((tx) => !tx.is_void);

  const dateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    switch (period) {
      case "past_month": {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        return { start, end };
      }
      case "ytd":
        return { start: new Date(year, 0, 1), end: now };
      case "prior_year":
        return { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31, 23, 59, 59, 999) };
      case "current_month":
      default:
        return { start: new Date(year, month, 1), end: now };
    }
  }, [period]);

  const totals = ACCOUNT_CBS_PAIRS.map((pair) => {
    const matchingTx = nonVoidedTransactions.filter((tx) => {
      const txDate = parseDateLocal(tx.transaction_date);
      if (txDate < dateRange.start || txDate > dateRange.end) return false;
      // Use master_acct_code (backfilled from UUID join in fetchRecentTransactions)
      const acctCode = tx.master_acct_code;
      const cbsCode = tx.cbs_code;
      return (
        (acctCode && pair.accounts.includes(acctCode)) ||
        cbsCode?.startsWith(pair.cbs)
      );
    });
    const totalDOP = matchingTx
      .filter((tx) => tx.currency === "DOP")
      .reduce((sum, tx) => sum + (parseFloat(String(tx.amount)) || 0), 0);
    const totalUSD = matchingTx
      .filter((tx) => tx.currency === "USD")
      .reduce((sum, tx) => sum + (parseFloat(String(tx.amount)) || 0), 0);
    const totalEUR = matchingTx
      .filter((tx) => tx.currency === "EUR")
      .reduce((sum, tx) => sum + (parseFloat(String(tx.amount)) || 0), 0);
    return { label: pair.label, count: matchingTx.length, totalDOP, totalUSD, totalEUR };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Purchase Totals by Account & CBS</CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="current_month">Mes Actual</SelectItem>
            <SelectItem value="past_month">Mes Anterior</SelectItem>
            <SelectItem value="ytd">Año en Curso</SelectItem>
            <SelectItem value="prior_year">Año Anterior</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account / CBS Pair</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Total DOP</TableHead>
              <TableHead className="text-right">Total USD</TableHead>
              <TableHead className="text-right">Total EUR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right font-mono">{row.count}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.totalDOP, "DOP")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.totalUSD, "USD")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.totalEUR, "EUR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
