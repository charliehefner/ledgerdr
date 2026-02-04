import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SelectedField } from "./types";

interface FieldSelectionSectionProps {
  fieldsData: Array<{
    id: string;
    name: string;
    hectares: number | null;
    farms: { id: string; name: string };
  }>;
  selectedFields: SelectedField[];
  onFieldsChange: (fields: SelectedField[]) => void;
  totalHectares: number;
}

export function FieldSelectionSection({
  fieldsData,
  selectedFields,
  onFieldsChange,
  totalHectares,
}: FieldSelectionSectionProps) {
  const { t } = useLanguage();

  const availableFields = fieldsData.filter(
    (f) => !selectedFields.some((sf) => sf.fieldId === f.id)
  );

  const handleAddField = (fieldId: string) => {
    const field = fieldsData.find((f) => f.id === fieldId);
    if (!field) return;

    onFieldsChange([
      ...selectedFields,
      {
        fieldId: field.id,
        fieldName: field.name,
        farmName: field.farms.name,
        totalHectares: field.hectares || 0,
        hectaresToApply: field.hectares || 0,
      },
    ]);
  };

  const handleRemoveField = (fieldId: string) => {
    onFieldsChange(selectedFields.filter((f) => f.fieldId !== fieldId));
  };

  const handleHectaresChange = (fieldId: string, hectares: number) => {
    onFieldsChange(
      selectedFields.map((f) =>
        f.fieldId === fieldId ? { ...f, hectaresToApply: hectares } : f
      )
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t("herbicide.fieldSelection")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add field selector */}
        <div className="flex gap-2">
          <Select onValueChange={handleAddField} value="">
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t("herbicide.selectField")} />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.farms.name} - {field.name} ({field.hectares || 0} ha)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={availableFields.length === 0}
            onClick={() => availableFields[0] && handleAddField(availableFields[0].id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected fields list */}
        <div className="space-y-2">
          {selectedFields.map((field) => (
            <div
              key={field.fieldId}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {field.farmName} - {field.fieldName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("herbicide.totalHa")}: {field.totalHectares} ha
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={field.hectaresToApply}
                  onChange={(e) =>
                    handleHectaresChange(field.fieldId, Number(e.target.value) || 0)
                  }
                  className="w-20"
                  min={0}
                  max={field.totalHectares}
                  step={0.1}
                />
                <span className="text-sm text-muted-foreground">ha</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveField(field.fieldId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Total hectares */}
        <div className="flex justify-between items-center pt-3 border-t font-medium">
          <span>{t("herbicide.sumHectares")}</span>
          <span className="text-lg">{totalHectares.toFixed(2)} ha</span>
        </div>
      </CardContent>
    </Card>
  );
}
