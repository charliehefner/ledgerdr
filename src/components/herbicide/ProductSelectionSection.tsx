import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SelectedProduct } from "./types";

interface ProductSelectionSectionProps {
  title: string;
  items: Array<{
    id: string;
    commercial_name: string;
    normal_dose_per_ha: number | null;
    current_quantity: number;
    use_unit: string;
  }>;
  selectedProducts: SelectedProduct[];
  onProductsChange: (products: SelectedProduct[]) => void;
}

export function ProductSelectionSection({
  title,
  items,
  selectedProducts,
  onProductsChange,
}: ProductSelectionSectionProps) {
  const { t } = useLanguage();

  const availableItems = items.filter(
    (item) => !selectedProducts.some((p) => p.itemId === item.id)
  );

  const handleAddProduct = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    onProductsChange([
      ...selectedProducts,
      {
        itemId: item.id,
        commercialName: item.commercial_name,
        dosePerHa: item.normal_dose_per_ha || 0,
        currentStock: item.current_quantity,
        useUnit: item.use_unit,
      },
    ]);
  };

  const handleRemoveProduct = (itemId: string) => {
    onProductsChange(selectedProducts.filter((p) => p.itemId !== itemId));
  };

  const handleDoseChange = (itemId: string, dose: number) => {
    onProductsChange(
      selectedProducts.map((p) =>
        p.itemId === itemId ? { ...p, dosePerHa: dose } : p
      )
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add product selector */}
        <div className="flex gap-2">
          <Select onValueChange={handleAddProduct} value={undefined}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t("herbicide.selectProduct")} />
            </SelectTrigger>
            <SelectContent>
              {availableItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.commercial_name} ({item.current_quantity} {item.use_unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={availableItems.length === 0}
            onClick={() => availableItems[0] && handleAddProduct(availableItems[0].id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected products list */}
        <div className="space-y-2">
          {selectedProducts.map((product) => (
            <div
              key={product.itemId}
              className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{product.commercialName}</div>
                <div className="text-xs text-muted-foreground">
                  {t("herbicide.stock")}: {product.currentStock} {product.useUnit}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={product.dosePerHa}
                  onChange={(e) =>
                    handleDoseChange(product.itemId, Number(e.target.value) || 0)
                  }
                  className="w-20 h-8"
                  min={0}
                  step={0.1}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {product.useUnit}/ha
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveProduct(product.itemId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {selectedProducts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {t("herbicide.noProductsSelected")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
