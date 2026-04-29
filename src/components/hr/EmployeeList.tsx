import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnSelector } from "@/components/ui/column-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Edit, Eye, Users, ArrowUpDown, ArrowUp, ArrowDown, Umbrella, AlertTriangle, Clock, CheckCircle, Ban, ToggleLeft, ToggleRight } from "lucide-react";
import { format, differenceInDays, addYears, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";
import { VacationCountdownDialog } from "./VacationCountdownDialog";
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";
import { useEntityFilter } from "@/hooks/useEntityFilter";

interface VacationSummary {
  employee_id: string;
  last_vacation_end: string | null;
}

interface Employee {
  id: string;
  name: string;
  cedula: string;
  position: string;
  bank: string | null;
  bank_account_number: string | null;
  date_of_birth: string | null;
  date_of_hire: string;
  salary: number;
  boot_size: string | null;
  pant_size: string | null;
  shirt_size: string | null;
  is_active: boolean;
  created_at: string;
}

interface EmployeeListProps {
  onEdit: (employeeId: string) => void;
}

type SortDirection = "asc" | "desc" | null;
type SortConfig = { key: string; direction: SortDirection };

const EMPLOYEE_COLUMN_KEYS = [
  ["name", "empList.col.name", true],
  ["cedula", "empList.col.cedula", true],
  ["position", "empList.col.position", true],
  ["date_of_hire", "empList.col.hireDate", true],
  ["vacations", "empList.col.vacations", true],
  ["salary", "empList.col.salary", true],
  ["bank", "empList.col.bank", false],
  ["bank_account_number", "empList.col.accountNumber", false],
  ["date_of_birth", "empList.col.birthDate", false],
  ["shirt_size", "empList.col.shirtSize", false],
  ["pant_size", "empList.col.pantSize", false],
  ["boot_size", "empList.col.bootSize", false],
  ["is_active", "empList.col.status", true],
] as const;

export function EmployeeList({ onEdit }: EmployeeListProps) {
  const { t } = useLanguage();
  const EMPLOYEE_COLUMNS = useMemo<ColumnConfig[]>(
    () => EMPLOYEE_COLUMN_KEYS.map(([key, labelKey, defaultVisible]) => ({
      key,
      label: t(labelKey),
      defaultVisible,
    })),
    [t]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [vacationDialogEmployee, setVacationDialogEmployee] = useState<{
    id: string;
    name: string;
    dateOfHire: string;
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "name", direction: "asc" });
  const { canModifySettings } = useAuth();
  const { selectedEntityId, isAllEntities } = useEntityFilter();

  const {
    visibility,
    toggleColumn,
    resetToDefaults,
    isVisible,
  } = useColumnVisibility("employee-list", EMPLOYEE_COLUMNS);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", selectedEntityId],
    queryFn: async () => {
      // Use employees_safe view to mask sensitive PII for non-admin users
      const query = supabase
        .from("employees_safe")
        .select("*")
        .order("name");
      const scopedQuery = !isAllEntities && selectedEntityId
        ? query.eq("entity_id", selectedEntityId)
        : query;
      const { data, error } = await scopedQuery;
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch vacation summary for all employees
  const { data: vacationSummary = [] } = useQuery({
    queryKey: ["employee-vacations-summary"],
    queryFn: async () => {
      // Get the most recent vacation end_date for each employee
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("employee_id, end_date")
        .order("end_date", { ascending: false });

      if (error) throw error;

      // Group by employee_id, keeping only the latest
      const summaryMap = new Map<string, string>();
      data.forEach((v) => {
        if (!summaryMap.has(v.employee_id)) {
          summaryMap.set(v.employee_id, v.end_date);
        }
      });

      return Array.from(summaryMap.entries()).map(([employee_id, last_vacation_end]) => ({
        employee_id,
        last_vacation_end,
      })) as VacationSummary[];
    },
  });

  // Helper to calculate vacation status
  const getVacationStatus = (employeeId: string, dateOfHire: string) => {
    const summary = vacationSummary.find((v) => v.employee_id === employeeId);
    const baseDate = summary?.last_vacation_end
      ? parseISO(summary.last_vacation_end)
      : parseISO(dateOfHire);
    const nextVacationDue = addYears(baseDate, 1);
    const today = new Date();
    const daysUntil = differenceInDays(nextVacationDue, today);
    return {
      daysUntil,
      isOverdue: daysUntil < 0,
      isDueSoon: daysUntil >= 0 && daysUntil <= 30,
    };
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { key: "name", direction: "asc" }; // Reset to default
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const sortedAndFilteredEmployees = useMemo(() => {
    if (!employees) return [];

    // Filter by active/inactive
    let filtered = employees.filter((emp) => emp.is_active === showActive);

    // Filter by search term
    filtered = filtered.filter(
      (emp) =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.cedula.includes(searchTerm) ||
        (emp.bank && emp.bank.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (emp.bank_account_number && emp.bank_account_number.includes(searchTerm))
    );

    // Sort
    if (sortConfig.key && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key as keyof Employee];
        const bVal = b[sortConfig.key as keyof Employee];

        // Handle nulls
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        // Handle booleans
        if (typeof aVal === "boolean" && typeof bVal === "boolean") {
          return sortConfig.direction === "asc"
            ? (aVal === bVal ? 0 : aVal ? -1 : 1)
            : (aVal === bVal ? 0 : aVal ? 1 : -1);
        }

        // Handle numbers
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        // Handle strings (including dates)
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortConfig.direction === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [employees, searchTerm, sortConfig, showActive]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
    }).format(amount);
  };

  const renderCellValue = (employee: Employee, key: string) => {
    switch (key) {
      case "name":
        return <span className="font-medium">{employee.name}</span>;
      case "cedula":
        return <span className="font-mono text-sm">{employee.cedula}</span>;
      case "date_of_hire":
        return format(parseDateLocal(employee.date_of_hire), "d MMM yyyy", { locale: es });
      case "date_of_birth":
        return employee.date_of_birth
          ? format(parseDateLocal(employee.date_of_birth), "d MMM yyyy", { locale: es })
          : "—";
      case "salary":
        return formatCurrency(employee.salary);
      case "position":
        return employee.position || "—";
      case "bank":
        return employee.bank || "—";
      case "bank_account_number":
        return employee.bank_account_number ? (
          <span className="font-mono text-sm">{employee.bank_account_number}</span>
        ) : "—";
      case "shirt_size":
        return employee.shirt_size || "—";
      case "pant_size":
        return employee.pant_size || "—";
      case "boot_size":
        return employee.boot_size || "—";
      case "vacations": {
        if (!employee.is_active) {
          return (
            <Badge variant="secondary" className="gap-1">
              <Ban className="h-3 w-3" />
              {t("empList.terminated")}
            </Badge>
          );
        }
        const status = getVacationStatus(employee.id, employee.date_of_hire);
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2"
            onClick={(e) => {
              e.stopPropagation();
              setVacationDialogEmployee({
                id: employee.id,
                name: employee.name,
                dateOfHire: employee.date_of_hire,
              });
            }}
          >
            {status.isOverdue ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("empList.daysOverdue").replace("{days}", String(Math.abs(status.daysUntil)))}
              </Badge>
            ) : status.isDueSoon ? (
              <Badge variant="secondary" className="gap-1 bg-warning/20 text-warning-foreground">
                <Clock className="h-3 w-3" />
                {t("empList.daysLeft").replace("{days}", String(status.daysUntil))}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                <CheckCircle className="h-3 w-3" />
                {t("empList.daysLeft").replace("{days}", String(status.daysUntil))}
              </Badge>
            )}
          </Button>
        );
      }
      case "is_active":
        return (
          <Badge variant={employee.is_active ? "default" : "secondary"}>
            {employee.is_active ? t("common.active") : t("common.inactive")}
          </Badge>
        );
      default:
        return "—";
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>{t("empList.title")}</CardTitle>
              {employees && (
                <Badge variant="secondary" className="ml-2">
                  {sortedAndFilteredEmployees.length} {t("empList.of")} {employees.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant={showActive ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowActive(!showActive)}
                className="gap-1.5 shrink-0"
              >
                {showActive ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {t("empList.activeToggle")}
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    {t("empList.inactiveToggle")}
                  </>
                )}
              </Button>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("empList.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ColumnSelector
                columns={EMPLOYEE_COLUMNS}
                visibility={visibility}
                onToggle={toggleColumn}
                onReset={resetToDefaults}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sortedAndFilteredEmployees.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchTerm ? t("empList.noResults") : t("empList.noEmployees")}
              description={searchTerm ? t("empList.noResultsDesc") : t("empList.noEmployeesDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {EMPLOYEE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                      <TableHead
                        key={col.key}
                        className={`cursor-pointer select-none hover:bg-muted/50 ${
                          col.key === "salary" ? "text-right" : ""
                        }`}
                        onClick={() => handleSort(col.key)}
                      >
                        <div className={`flex items-center ${col.key === "salary" ? "justify-end" : ""}`}>
                          {col.label}
                          {getSortIcon(col.key)}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t("empList.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAndFilteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      {EMPLOYEE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                        <TableCell
                          key={col.key}
                          className={col.key === "salary" ? "text-right" : ""}
                        >
                          {renderCellValue(employee, col.key)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmployee(employee.id)}
                            title={t("empList.viewDetails")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canModifySettings && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(employee.id)}
                              title={t("empList.editEmployee")}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeDetailDialog
        employeeId={selectedEmployee}
        open={!!selectedEmployee}
        onOpenChange={(open) => !open && setSelectedEmployee(null)}
      />

      <VacationCountdownDialog
        open={!!vacationDialogEmployee}
        onOpenChange={(open) => !open && setVacationDialogEmployee(null)}
        employeeId={vacationDialogEmployee?.id ?? null}
        employeeName={vacationDialogEmployee?.name ?? ""}
        dateOfHire={vacationDialogEmployee?.dateOfHire ?? ""}
      />
    </>
  );
}
