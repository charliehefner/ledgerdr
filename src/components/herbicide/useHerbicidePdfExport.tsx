import { useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CalculationResult } from "./types";

export function useHerbicidePdfExport() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const exportToPdf = useCallback(
    (result: CalculationResult, tankSize: number) => {
      try {
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "letter",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();

        // Title
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text(t("herbicide.title"), 14, 15);

        // Subtitle with date
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(
          `${t("herbicide.generated")}: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
          14,
          22
        );
        pdf.text(`${t("herbicide.tankSize")}: ${tankSize} L`, 14, 27);
        pdf.text(
          `${t("herbicide.totalHectares")}: ${result.totalHectares.toFixed(2)} ha`,
          80,
          27
        );

        let yPos = 35;

        // Product Totals Table
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(t("herbicide.productTotals"), 14, yPos);
        yPos += 5;

        autoTable(pdf, {
          startY: yPos,
          head: [
            [
              t("herbicide.product"),
              t("herbicide.totalRequired"),
              t("herbicide.currentStock"),
              t("herbicide.status"),
            ],
          ],
          body: result.productTotals.map((p) => [
            p.productName,
            `${p.totalAmount.toFixed(2)} ${p.unit}`,
            `${p.currentStock.toFixed(2)} ${p.unit}`,
            p.shortfall > 0
              ? `${t("herbicide.lacking")} ${p.shortfall.toFixed(2)} ${p.unit}`
              : "OK",
          ]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: {
            fillColor: [79, 129, 189],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        // Tank Mixtures
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          `${t("herbicide.tankMixtures")} (${result.tankCount} ${t("herbicide.tanks")})`,
          14,
          yPos
        );
        yPos += 5;

        const tankHeaders = [t("herbicide.tank"), t("herbicide.volume"), ...result.productTotals.map((p) => p.productName)];
        const tankBody = result.tankMixtures.map((tank) => [
          `#${tank.tankNumber}${tank.isPartial ? ` (${t("herbicide.partial")})` : ""}`,
          `${tank.tankVolume.toFixed(0)} L`,
          ...tank.products.map((p) => `${p.amount.toFixed(2)} ${p.unit}`),
        ]);

        autoTable(pdf, {
          startY: yPos,
          head: [tankHeaders],
          body: tankBody,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: {
            fillColor: [79, 129, 189],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        yPos = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        // Check if we need a new page
        if (yPos > 170) {
          pdf.addPage();
          yPos = 20;
        }

        // Field Applications
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(t("herbicide.fieldApplications"), 14, yPos);
        yPos += 5;

        const fieldHeaders = [
          t("herbicide.field"),
          t("herbicide.hectares"),
          ...result.productTotals.map((p) => p.productName),
        ];
        const fieldBody = [
          ...result.fieldApplications.map((field) => [
            field.fieldName,
            field.hectares.toFixed(2),
            ...field.products.map((p) => `${p.amount.toFixed(2)}`),
          ]),
          // Totals row
          [
            t("common.total"),
            result.totalHectares.toFixed(2),
            ...result.productTotals.map((p) => p.totalAmount.toFixed(2)),
          ],
        ];

        autoTable(pdf, {
          startY: yPos,
          head: [fieldHeaders],
          body: fieldBody,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: {
            fillColor: [79, 129, 189],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          didParseCell: (data) => {
            // Bold the totals row
            if (data.row.index === fieldBody.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [217, 225, 242];
            }
          },
        });

        // Save PDF
        pdf.save(`herbicide-calculation-${format(new Date(), "yyyy-MM-dd")}.pdf`);

        toast({
          title: t("herbicide.pdfGenerated"),
          description: t("herbicide.pdfGeneratedDesc"),
        });
      } catch (error) {
        console.error("PDF export error:", error);
        toast({
          title: "Error",
          description: t("herbicide.pdfError"),
          variant: "destructive",
        });
      }
    },
    [toast, t]
  );

  return { exportToPdf };
}
