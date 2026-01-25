import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

type SortField = "transaction_date" | "tractor" | "gallons" | null;
type SortDirection = "asc" | "desc";

interface FuelTransaction {
  id: string;
  tank_id: string;
  equipment_id: string;
  transaction_date: string;
  gallons: number;
  notes: string | null;
  fuel_tanks: { name: string };
  fuel_equipment: { name: string };
}

export function TankHistoryView() {
  const [selectedTank, setSelectedTank] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch agriculture tanks
  const { data: tanks = [] } = useQuery({
    queryKey: ["fuelTanks", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name")
        .eq("use_type", "agriculture")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all agriculture transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select(`
          *,
          fuel_tanks!inner(name, use_type),
          fuel_equipment!inner(name, equipment_type)
        `)
        .eq("fuel_tanks.use_type", "agriculture")
        .eq("transaction_type", "dispense")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as FuelTransaction[];
    },
  });

  // Filter by tank and date
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Filter by tank
    if (selectedTank !== "all") {
      filtered = filtered.filter((tx) => tx.tank_id === selectedTank);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.transaction_date);
        if (startDate && endDate) {
          return isWithinInterval(txDate, { 
            start: startOfDay(startDate), 
            end: endOfDay(endDate) 
          });
        }
        if (startDate) return txDate >= startOfDay(startDate);
        if (endDate) return txDate <= endOfDay(endDate);
        return true;
      });
    }
    
    return filtered;
  }, [transactions, selectedTank, startDate, endDate]);

  // Sorting
  const sortedTransactions = useMemo(() => {
    if (!sortField) return filteredTransactions;

    return [...filteredTransactions].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "transaction_date":
          comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
          break;
        case "tractor":
          comparison = a.fuel_equipment.name.localeCompare(b.fuel_equipment.name);
          break;
        case "gallons":
          comparison = a.gallons - b.gallons;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredTransactions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "desc") setSortDirection("asc");
      else setSortField(null);
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />;
    return sortDirection === "desc" ? <ArrowDown className="ml-1 h-4 w-4" /> : <ArrowUp className="ml-1 h-4 w-4" />;
  };

  const totalGallons = sortedTransactions.reduce((sum, tx) => sum + tx.gallons, 0);

  // Per-tank summary
  const tankSummaries = useMemo(() => {
    const summaries: Record<string, { name: string; totalGallons: number; transactionCount: number }> = {};
    filteredTransactions.forEach((tx) => {
      if (!summaries[tx.tank_id]) {
        summaries[tx.tank_id] = { name: tx.fuel_tanks.name, totalGallons: 0, transactionCount: 0 };
      }
      summaries[tx.tank_id].totalGallons += tx.gallons;
      summaries[tx.tank_id].transactionCount += 1;
    });
    return Object.values(summaries);
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {tankSummaries.map((summary) => (
          <Card key={summary.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{summary.name}</CardTitle>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalGallons.toFixed(1)} gal</div>
              <p className="text-xs text-muted-foreground">
                {summary.transactionCount} transactions in period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedTank} onValueChange={setSelectedTank}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All tanks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tanks</SelectItem>
            {tanks.map((tank) => (
              <SelectItem key={tank.id} value={tank.id}>
                {tank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "dd/MM/yyyy") : "Start Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "dd/MM/yyyy") : "End Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary */}
      {sortedTransactions.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {sortedTransactions.length} records | Total: <span className="font-semibold text-foreground">{totalGallons.toFixed(1)} gallons</span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : sortedTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Fuel className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No transactions found for selected filters.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("transaction_date")}>
                  Date {getSortIcon("transaction_date")}
                </Button>
              </TableHead>
              <TableHead>Tank</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("tractor")}>
                  Tractor {getSortIcon("tractor")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("gallons")}>
                  Gallons {getSortIcon("gallons")}
                </Button>
              </TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{format(new Date(tx.transaction_date), "MMM d, yyyy HH:mm")}</TableCell>
                <TableCell>{tx.fuel_tanks.name}</TableCell>
                <TableCell>{tx.fuel_equipment.name}</TableCell>
                <TableCell className="font-medium">{tx.gallons.toFixed(1)} gal</TableCell>
                <TableCell className="text-muted-foreground">{tx.notes || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
