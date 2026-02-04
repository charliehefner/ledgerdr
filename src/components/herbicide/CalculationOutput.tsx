import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CalculationResult } from "./types";

interface CalculationOutputProps {
  result: CalculationResult;
  tankSize: number;
}

export function CalculationOutput({ result, tankSize }: CalculationOutputProps) {
  const { t } = useLanguage();

  const hasShortfall = result.productTotals.some((p) => p.shortfall > 0);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Inventory Alert */}
      {hasShortfall && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("herbicide.inventoryAlert")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc list-inside">
              {result.productTotals
                .filter((p) => p.shortfall > 0)
                .map((p) => (
                  <li key={p.productName}>
                    <strong>{p.productName}</strong>: {t("herbicide.lacking")}{" "}
                    {p.shortfall.toFixed(2)} {p.unit}
                  </li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Product Totals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("herbicide.productTotals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("herbicide.product")}</TableHead>
                <TableHead className="text-right">{t("herbicide.totalRequired")}</TableHead>
                <TableHead className="text-right">{t("herbicide.currentStock")}</TableHead>
                <TableHead className="text-right">{t("herbicide.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.productTotals.map((product) => (
                <TableRow key={product.productName}>
                  <TableCell className="font-medium">{product.productName}</TableCell>
                  <TableCell className="text-right">
                    {product.totalAmount.toFixed(2)} {product.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.currentStock.toFixed(2)} {product.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.shortfall > 0 ? (
                      <span className="text-destructive font-medium">
                        -{product.shortfall.toFixed(2)} {product.unit}
                      </span>
                    ) : (
                      <span className="text-primary font-medium">✓ OK</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tank Mixtures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {t("herbicide.tankMixtures")} ({result.tankCount} {t("herbicide.tanks")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3">
            {result.tankMixtures.map((tank) => (
              <div
                key={tank.tankNumber}
                className={`p-4 rounded-lg border ${
                  tank.isPartial ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "bg-muted/30"
                }`}
              >
                <div className="font-medium mb-2">
                  {t("herbicide.tank")} #{tank.tankNumber}
                  {tank.isPartial && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                      ({t("herbicide.partial")})
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {tank.tankVolume.toFixed(0)} L
                </div>
                <ul className="space-y-1 text-sm">
                  {tank.products.map((product) => (
                    <li key={product.productName} className="flex justify-between">
                      <span className="truncate mr-2">{product.productName}</span>
                      <span className="font-mono">
                        {product.amount.toFixed(2)} {product.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Field Application Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("herbicide.fieldApplications")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("herbicide.field")}</TableHead>
                <TableHead className="text-right">{t("herbicide.hectares")}</TableHead>
                {result.productTotals.map((p) => (
                  <TableHead key={p.productName} className="text-right">
                    {p.productName}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.fieldApplications.map((field) => (
                <TableRow key={field.fieldName}>
                  <TableCell className="font-medium">{field.fieldName}</TableCell>
                  <TableCell className="text-right">{field.hectares.toFixed(2)}</TableCell>
                  {field.products.map((product) => (
                    <TableCell key={product.productName} className="text-right font-mono">
                      {product.amount.toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>{t("common.total")}</TableCell>
                <TableCell className="text-right">
                  {result.totalHectares.toFixed(2)}
                </TableCell>
                {result.productTotals.map((p) => (
                  <TableCell key={p.productName} className="text-right font-mono">
                    {p.totalAmount.toFixed(2)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
