import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Printer, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { TankSizeInput } from "./TankSizeInput";
import { FieldSelectionSection } from "./FieldSelectionSection";
import { ProductSelectionSection } from "./ProductSelectionSection";
import { CalculationOutput } from "./CalculationOutput";
import { useHerbicidePdfExport } from "./useHerbicidePdfExport";
import type { 
  SelectedField, 
  SelectedProduct, 
  CalculationResult, 
  TankMixture, 
  FieldApplication,
  ProductTotal
} from "./types";

export function HerbicideCalculation() {
  const { t } = useLanguage();
  const [tankSize, setTankSize] = useState(800);
  const [selectedFields, setSelectedFields] = useState<SelectedField[]>([]);
  const [herbicides, setHerbicides] = useState<SelectedProduct[]>([]);
  const [adherents, setAdherents] = useState<SelectedProduct[]>([]);
  const [conditioners, setConditioners] = useState<SelectedProduct[]>([]);

  const { exportToPdf } = useHerbicidePdfExport();

  // Fetch fields with farm info
  const { data: fieldsData = [] } = useQuery({
    queryKey: ["herbicide-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select(`
          id,
          name,
          hectares,
          is_active,
          farms!inner (id, name, is_active)
        `)
        .eq("is_active", true)
        .eq("farms.is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch inventory items
  const { data: inventoryData = [] } = useQuery({
    queryKey: ["herbicide-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, normal_dose_per_ha, current_quantity, use_unit, function")
        .eq("is_active", true)
        .order("commercial_name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Filter inventory by function
  const herbicideItems = inventoryData.filter(
    (item) => item.function === "pre_emergent_herbicide" || item.function === "post_emergent_herbicide"
  );
  const adherentItems = inventoryData.filter((item) => item.function === "adherente");
  const conditionerItems = inventoryData.filter((item) => item.function === "condicionador");

  // Calculate totals
  const totalHectares = useMemo(
    () => selectedFields.reduce((sum, f) => sum + f.hectaresToApply, 0),
    [selectedFields]
  );

  const allProducts = useMemo(
    () => [...herbicides, ...adherents, ...conditioners],
    [herbicides, adherents, conditioners]
  );

  // Calculate results
  const calculationResult: CalculationResult | null = useMemo(() => {
    if (totalHectares === 0 || allProducts.length === 0) return null;

    // Calculate product totals
    const productTotals: ProductTotal[] = allProducts.map((product) => {
      const totalAmount = product.dosePerHa * totalHectares;
      const shortfall = Math.max(0, totalAmount - product.currentStock);
      return {
        productName: product.commercialName,
        totalAmount,
        unit: product.useUnit,
        currentStock: product.currentStock,
        shortfall,
      };
    });

    // Calculate tank mixtures
    const tankCount = Math.ceil(totalHectares / (tankSize / 100)); // Assuming 100L per hectare spray rate
    const hectaresPerTank = tankSize / 100;
    const tankMixtures: TankMixture[] = [];
    
    let remainingHectares = totalHectares;
    for (let i = 0; i < tankCount; i++) {
      const tankHectares = Math.min(hectaresPerTank, remainingHectares);
      const isPartial = tankHectares < hectaresPerTank;
      const tankVolume = isPartial ? (tankHectares / hectaresPerTank) * tankSize : tankSize;
      
      tankMixtures.push({
        tankNumber: i + 1,
        tankVolume,
        isPartial,
        products: allProducts.map((product) => ({
          productName: product.commercialName,
          amount: product.dosePerHa * tankHectares,
          unit: product.useUnit,
        })),
      });
      
      remainingHectares -= tankHectares;
    }

    // Calculate field applications
    const fieldApplications: FieldApplication[] = selectedFields.map((field) => ({
      fieldName: `${field.farmName} - ${field.fieldName}`,
      hectares: field.hectaresToApply,
      products: allProducts.map((product) => ({
        productName: product.commercialName,
        amount: product.dosePerHa * field.hectaresToApply,
        unit: product.useUnit,
      })),
    }));

    return {
      totalHectares,
      tankCount,
      tankMixtures,
      productTotals,
      fieldApplications,
    };
  }, [totalHectares, allProducts, tankSize, selectedFields]);

  const handleExportPdf = () => {
    if (calculationResult) {
      exportToPdf(calculationResult, tankSize);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    setSelectedFields([]);
    setHerbicides([]);
    setAdherents([]);
    setConditioners([]);
    setTankSize(800);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Tank Size */}
      <TankSizeInput value={tankSize} onChange={setTankSize} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4">
        {/* Field Selection */}
        <FieldSelectionSection
          fieldsData={fieldsData}
          selectedFields={selectedFields}
          onFieldsChange={setSelectedFields}
          totalHectares={totalHectares}
        />

        {/* Product Selection */}
        <div className="space-y-4">
          <ProductSelectionSection
            title={t("herbicide.herbicides")}
            items={herbicideItems}
            selectedProducts={herbicides}
            onProductsChange={setHerbicides}
          />
          <ProductSelectionSection
            title={t("herbicide.adherents")}
            items={adherentItems}
            selectedProducts={adherents}
            onProductsChange={setAdherents}
          />
          <ProductSelectionSection
            title={t("herbicide.conditioners")}
            items={conditionerItems}
            selectedProducts={conditioners}
            onProductsChange={setConditioners}
          />
        </div>
      </div>

      {/* Output Section */}
      {calculationResult && (
        <>
          <CalculationOutput result={calculationResult} tankSize={tankSize} />

          {/* Export Actions */}
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>{t("herbicide.exportReport")}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button onClick={handleExportPdf} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                {t("herbicide.downloadPdf")}
              </Button>
              <Button onClick={handlePrint} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                {t("herbicide.print")}
              </Button>
              <Button onClick={handleClear} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("herbicide.clear")}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
