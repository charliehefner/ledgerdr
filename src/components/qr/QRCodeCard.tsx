import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Tractor, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QRCodeCardProps {
  type: "tractor" | "tank";
  id: string;
  name: string;
  subtitle?: string;
}

export function QRCodeCard({ type, id, name, subtitle }: QRCodeCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Generate compact QR data
  const qrData = JSON.stringify({ t: type, id });

  const handleDownload = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Create canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with padding for label
    const padding = 40;
    const labelHeight = 60;
    const qrSize = 200;
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2 + labelHeight;

    // White background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw QR code
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, qrSize, qrSize);

      // Add label
      ctx.fillStyle = "black";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(name, canvas.width / 2, qrSize + padding + 30);
      
      if (subtitle) {
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText(subtitle, canvas.width / 2, qrSize + padding + 50);
      }

      // Download
      const link = document.createElement("a");
      link.download = `qr-${type}-${name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const Icon = type === "tractor" ? Tractor : Fuel;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div 
            ref={qrRef}
            className="bg-white p-2 rounded border"
          >
            <QRCodeSVG
              value={qrData}
              size={80}
              level="M"
              includeMargin={false}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase">
                {type === "tractor" ? "Tractor" : "Tanque"}
              </span>
            </div>
            <p className="font-medium truncate">{name}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
