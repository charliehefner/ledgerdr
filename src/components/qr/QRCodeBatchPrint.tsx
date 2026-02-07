import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Loader2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

interface QRCodeBatchPrintProps {
  type: "tractors" | "tanks" | "all";
  tractors: Array<{ id: string; name: string; brand?: string | null }>;
  tanks: Array<{ id: string; name: string; capacity_gallons: number }>;
  onClose: () => void;
}

export function QRCodeBatchPrint({ type, tractors, tanks, onClose }: QRCodeBatchPrintProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const qrSize = 50;
      const cellWidth = (pageWidth - margin * 2) / 3;
      const cellHeight = 70;
      const qrsPerRow = 3;
      const rowsPerPage = Math.floor((pageHeight - margin * 2) / cellHeight);

      // Combine items based on type
      const items: Array<{ type: "tractor" | "tank"; id: string; name: string; subtitle: string }> = [];
      
      if (type !== "tanks") {
        tractors.forEach(t => items.push({
          type: "tractor",
          id: t.id,
          name: t.name,
          subtitle: t.brand || "Tractor",
        }));
      }
      
      if (type !== "tractors") {
        tanks.forEach(t => items.push({
          type: "tank",
          id: t.id,
          name: t.name,
          subtitle: `${t.capacity_gallons} gal`,
        }));
      }

      let currentPage = 0;
      let currentRow = 0;
      let currentCol = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Check if we need a new page
        if (currentRow >= rowsPerPage) {
          pdf.addPage();
          currentPage++;
          currentRow = 0;
          currentCol = 0;
        }

        // Calculate position
        const x = margin + currentCol * cellWidth + (cellWidth - qrSize) / 2;
        const y = margin + currentRow * cellHeight;

        // Generate QR code as data URL
        const qrData = JSON.stringify({ t: item.type, id: item.id });
        const qrCanvas = document.createElement("canvas");
        const qrCtx = qrCanvas.getContext("2d");
        if (qrCtx) {
          // Create a temporary SVG element
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>`;
          document.body.appendChild(tempDiv);
          
          // Use the QRCode library directly to get image data
          const QRCode = await import("qrcode");
          const qrDataUrl = await QRCode.toDataURL(qrData, { 
            width: 200, 
            margin: 1,
            errorCorrectionLevel: "M"
          });
          
          document.body.removeChild(tempDiv);

          // Add QR code to PDF
          pdf.addImage(qrDataUrl, "PNG", x, y, qrSize, qrSize);
        }

        // Add label
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        const labelY = y + qrSize + 5;
        pdf.text(item.name, x + qrSize / 2, labelY, { align: "center" });

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(item.subtitle, x + qrSize / 2, labelY + 4, { align: "center" });

        // Move to next position
        currentCol++;
        if (currentCol >= qrsPerRow) {
          currentCol = 0;
          currentRow++;
        }
      }

      // Save the PDF
      const fileName = type === "all" 
        ? "codigos-qr-todos.pdf"
        : type === "tractors"
          ? "codigos-qr-tractores.pdf"
          : "codigos-qr-tanques.pdf";
      
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
      onClose();
    }
  };

  const itemCount = (type !== "tanks" ? tractors.length : 0) + 
                    (type !== "tractors" ? tanks.length : 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Imprimir Códigos QR</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Se generará un PDF con {itemCount} código(s) QR organizados en una cuadrícula
            de 3 columnas, listo para imprimir y recortar.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p><strong>Contenido:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {type !== "tanks" && (
                <li>{tractors.length} tractores</li>
              )}
              {type !== "tractors" && (
                <li>{tanks.length} tanques</li>
              )}
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Descargar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
