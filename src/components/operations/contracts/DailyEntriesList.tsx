import { ContractEntry } from "../ContractedServicesView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DailyEntriesListProps {
  entries: ContractEntry[];
  isLoading: boolean;
  onEdit: (entry: ContractEntry) => void;
  onDelete: (id: string) => void;
}

const UNIT_LABELS: Record<string, string> = {
  m3: "m³",
  hours: "hrs",
  hectares: "ha",
};

export function DailyEntriesList({ entries, isLoading, onEdit, onDelete }: DailyEntriesListProps) {
  const { t } = useLanguage();

  const getFinalCost = (entry: ContractEntry) => {
    const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
    const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
    return baseCost + lineItemsTotal;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("contracts.noEntries")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.date")}</TableHead>
            <TableHead>{t("contracts.contract")}</TableHead>
            <TableHead>{t("common.description")}</TableHead>
            <TableHead className="text-right">{t("contracts.unitsCharged")}</TableHead>
            <TableHead className="text-right">{t("contracts.calculatedCost")}</TableHead>
            <TableHead className="text-right">{t("contracts.lineItems")}</TableHead>
            <TableHead className="text-right">{t("contracts.totalCost")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const contract = entry.contract;
            const unitLabel = contract ? UNIT_LABELS[contract.unit_type] || contract.unit_type : "";
            const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
            const hasOverride = entry.cost_override !== null;
            const finalCost = getFinalCost(entry);

            return (
              <TableRow key={entry.id}>
                <TableCell>{format(new Date(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-medium">
                  {contract?.contract_name || "-"}
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate" title={entry.description}>
                    {entry.description}
                  </div>
                  {entry.comments && (
                    <div className="text-xs text-muted-foreground truncate" title={entry.comments}>
                      {entry.comments}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {entry.units_charged.toLocaleString()} {unitLabel}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={hasOverride ? "line-through text-muted-foreground" : ""}>
                    ${entry.calculated_cost.toLocaleString()}
                  </span>
                  {hasOverride && (
                    <div className="text-primary">
                      ${entry.cost_override?.toLocaleString()}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(entry.line_items?.length || 0) > 0 ? (
                    <Badge variant="outline">
                      +${lineItemsTotal.toLocaleString()} ({entry.line_items?.length})
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  ${finalCost.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("contracts.confirmDeleteEntry")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("contracts.confirmDeleteEntryDesc")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(entry.id)}>
                            {t("common.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
