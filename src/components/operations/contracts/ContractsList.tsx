import { ServiceContract } from "../ContractedServicesView";
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

interface ContractsListProps {
  contracts: ServiceContract[];
  isLoading: boolean;
  onEdit: (contract: ServiceContract) => void;
  onDelete: (id: string) => void;
}

const OPERATION_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  bulldozer: { es: "Bulldozer", en: "Bulldozer" },
  excavator: { es: "Excavadora", en: "Excavator" },
  tractor: { es: "Tractor", en: "Tractor" },
  backhoe: { es: "Retroexcavadora", en: "Backhoe" },
  transportation: { es: "Transporte", en: "Transportation" },
  other: { es: "Otro", en: "Other" },
};

const UNIT_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  m3: { es: "m³", en: "m³" },
  hours: { es: "Horas", en: "Hours" },
  hectares: { es: "Hectáreas", en: "Hectares" },
};

export function ContractsList({ contracts, isLoading, onEdit, onDelete }: ContractsListProps) {
  const { language, t } = useLanguage();

  const getOperationTypeLabel = (type: string, other?: string | null) => {
    if (type === "other" && other) return other;
    return OPERATION_TYPE_LABELS[type]?.[language] || type;
  };

  const getUnitTypeLabel = (type: string) => {
    return UNIT_TYPE_LABELS[type]?.[language] || type;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>;
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("contracts.noContracts")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("contracts.contractName")}</TableHead>
            <TableHead>{t("contracts.owner")}</TableHead>
            <TableHead>{t("contracts.operationType")}</TableHead>
            <TableHead>{t("contracts.unitType")}</TableHead>
            <TableHead className="text-right">{t("contracts.pricePerUnit")}</TableHead>
            <TableHead>{t("contracts.farm")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell className="font-medium">{contract.contract_name}</TableCell>
              <TableCell>
                <div>
                  <div>{contract.owner_name}</div>
                  {contract.owner_cedula_rnc && (
                    <div className="text-xs text-muted-foreground">
                      {contract.owner_cedula_rnc}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {getOperationTypeLabel(contract.operation_type, contract.operation_type_other)}
              </TableCell>
              <TableCell>{getUnitTypeLabel(contract.unit_type)}</TableCell>
              <TableCell className="text-right font-mono">
                ${contract.price_per_unit.toLocaleString()}
              </TableCell>
              <TableCell>{contract.farm?.name || "-"}</TableCell>
              <TableCell>
                <Badge variant={contract.is_active ? "default" : "secondary"}>
                  {contract.is_active ? t("common.active") : t("common.inactive")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(contract)}>
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
                        <AlertDialogTitle>{t("contracts.confirmDelete")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("contracts.confirmDeleteDesc")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(contract.id)}>
                          {t("common.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
