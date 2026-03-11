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
import { Tractor, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, Gauge } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { parseDateLocal } from "@/lib/dateUtils";

type SortField = "transaction_date" | "tank" | "gallons" | "hours" | "consumption" | null;
type SortDirection = "asc" | "desc";

interface FuelTransaction {
  id: string;
  tank_id: string;
  equipment_id: string;
  transaction_date: string;
  gallons: number;
  hour_meter_reading: number;
  previous_hour_meter: number;
  notes: string | null;
  fuel_tanks: { name: string };
  fuel_equipment: { name: string };
}

export function TractorHistoryView() {
  const [selectedTractor, setSelectedTractor] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch tractors
  const { data: tractors = [] } = useQuery({
    queryKey: ["fuelEquipment", "tractor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter")
        .eq("equipment_type", "tractor")
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

  // Filter by tractor and date
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    if (selectedTractor !== "all") {
      filtered = filtered.filter((tx) => tx.equipment_id === selectedTractor);
    }
    
    if (startDate || endDate) {
      filtered = filtered.filter((tx) => {
        const txDate = parseDateLocal(tx.transaction_date);
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
  }, [transactions, selectedTractor, startDate, endDate]);

  // Calculate hours worked and consumption rate for each transaction
  const transactionsWithStats = useMemo(() => {
    return filteredTransactions.map((tx) => {
      const hoursWorked = Math.max(0, (tx.hour_meter_reading ?? 0) - (tx.previous_hour_meter ?? 0));
      const gallons = Number(tx.gallons) || 0;
      const consumptionRate = hoursWorked > 0 ? gallons / hoursWorked : null;
      return { ...tx, hoursWorked, consumptionRate, gallons };
    });
  }, [filteredTransactions]);

  // Sorting
  const sortedTransactions = useMemo(() => {
    if (!sortField) return transactionsWithStats;

    return [...transactionsWithStats].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "transaction_date":
          comparison = parseDateLocal(a.transaction_date).getTime() - parseDateLocal(b.transaction_date).getTime();
          break;
        case "tank":
          comparison = (a.fuel_tanks?.name ?? "").localeCompare(b.fuel_tanks?.name ?? "");
          break;
        case "gallons":
          comparison = a.gallons - b.gallons;
          break;
        case "hours":
          comparison = a.hoursWorked - b.hoursWorked;
          break;
        case "consumption":
          comparison = (a.consumptionRate || 0) - (b.consumptionRate || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactionsWithStats, sortField, sortDirection]);

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

  // Per-tractor summary
  const tractorSummaries = useMemo(() => {
    const summaries: Record<string, { 
      name: string; 
      totalGallons: number; 
      totalHours: number; 
      avgConsumption: number;
      transactionCount: number;
    }> = {};
    
    transactionsWithStats.forEach((tx) => {
      if (!summaries[tx.equipment_id]) {
        summaries[tx.equipment_id] = { 
          name: tx.fuel_equipment?.name || "Unknown", 
          totalGallons: 0, 
          totalHours: 0,
          avgConsumption: 0,
          transactionCount: 0 
        };
      }
      summaries[tx.equipment_id].totalGallons += tx.gallons;
      summaries[tx.equipment_id].totalHours += tx.hoursWorked;
      summaries[tx.equipment_id].transactionCount += 1;
    });
    
    // Calculate average consumption
    Object.values(summaries).forEach((s) => {
      s.avgConsumption = s.totalHours > 0 ? s.totalGallons / s.totalHours : 0;
    });
    
    return Object.values(summaries);
  }, [transactionsWithStats]);

  const totalGallons = sortedTransactions.reduce((sum, tx) => sum + tx.gallons, 0);
  const totalHours = sortedTransactions.reduce((sum, tx) => sum + tx.hoursWorked, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {tractorSummaries.map((summary) => (
          <Card key={summary.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{summary.name}</CardTitle>
              <Tractor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalGallons.toFixed(1)} gal</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{summary.totalHours.toFixed(1)} hrs</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  {summary.avgConsumption.toFixed(2)} gal/hr
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedTractor} onValueChange={setSelectedTractor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All tractors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tractors</SelectItem>
            {tractors.map((tractor) => (
              <SelectItem key={tractor.id} value={tractor.id}>
                {tractor.name}
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
          Showing {sortedTransactions.length} records | Total: <span className="font-semibold text-foreground">{totalGallons.toFixed(1)} gallons</span> over <span className="font-semibold text-foreground">{totalHours.toFixed(1)} hours</span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : sortedTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tractor className="mx-auto h-12 w-12 mb-4 opacity-50" />
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
              <TableHead>Tractor</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("tank")}>
                  Tank {getSortIcon("tank")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("gallons")}>
                  Gallons {getSortIcon("gallons")}
                </Button>
              </TableHead>
              <TableHead>Start Hours</TableHead>
              <TableHead>End Hours</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("hours")}>
                  Hours Worked {getSortIcon("hours")}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("consumption")}>
                  Gal/Hr {getSortIcon("consumption")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{format(parseDateLocal(tx.transaction_date), "MMM d, yyyy")}</TableCell>
                <TableCell>{tx.fuel_equipment?.name || "-"}</TableCell>
                <TableCell>{tx.fuel_tanks?.name || "-"}</TableCell>
                <TableCell className="font-medium">{tx.gallons.toFixed(1)} gal</TableCell>
                <TableCell>{(tx.previous_hour_meter ?? 0).toFixed(1)}</TableCell>
                <TableCell>{(tx.hour_meter_reading ?? 0).toFixed(1)}</TableCell>
                <TableCell>{tx.hoursWorked.toFixed(1)} hrs</TableCell>
                <TableCell className={cn(
                  "font-medium",
                  tx.consumptionRate && tx.consumptionRate > 5 ? "text-destructive" : "text-primary"
                )}>
                  {tx.consumptionRate ? `${tx.consumptionRate.toFixed(2)}` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
