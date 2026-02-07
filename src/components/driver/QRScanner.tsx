import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { X, Camera, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QRScannerProps {
  onScan: (result: { type: string; id: string }) => void;
  onClose: () => void;
  expectedType: "tractor" | "tank";
}

export function QRScanner({ onScan, onClose, expectedType }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      if (!containerRef.current) return;

      try {
        // Check for camera access
        const devices = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (devices.length === 0) {
          setHasCamera(false);
          return;
        }

        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              if (data.t === expectedType || data.type === expectedType) {
                scanner.stop().catch(() => {});
                onScan({ type: data.t || data.type, id: data.id });
              } else {
                setError(`Código QR no es de un ${expectedType === "tractor" ? "tractor" : "tanque"}`);
              }
            } catch {
              setError("Código QR no válido");
            }
          },
          () => {} // Ignore scan errors
        );

        if (mounted) setIsScanning(true);
      } catch (err) {
        console.error("Scanner error:", err);
        if (mounted) {
          setHasCamera(false);
          setError("No se pudo acceder a la cámara");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          scannerRef.current.stop().catch(() => {});
        }
      }
    };
  }, [expectedType, onScan]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const scanner = new Html5Qrcode("qr-file-reader");
      const result = await scanner.scanFile(file, true);
      
      const data = JSON.parse(result);
      if (data.t === expectedType || data.type === expectedType) {
        onScan({ type: data.t || data.type, id: data.id });
      } else {
        setError(`Código QR no es de un ${expectedType === "tractor" ? "tractor" : "tanque"}`);
      }
    } catch (err) {
      setError("No se pudo leer el código QR de la imagen");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <p className="font-medium">
            Escanear {expectedType === "tractor" ? "Tractor" : "Tanque"}
          </p>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {hasCamera ? (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div 
                  id="qr-reader" 
                  ref={containerRef}
                  className="w-full aspect-square"
                />
              </CardContent>
            </Card>
            
            <p className="text-center text-sm text-muted-foreground">
              Apunte la cámara al código QR
            </p>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="bg-muted rounded-full p-6 mb-4">
                <Camera className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-center text-muted-foreground mb-4">
                No se pudo acceder a la cámara. Suba una imagen del código QR.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Hidden div for file scanning */}
        <div id="qr-file-reader" className="hidden" />

        {/* File upload fallback */}
        <div className="mt-4">
          <label className="block">
            <Button variant="outline" className="w-full" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Subir imagen del QR
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </span>
            </Button>
          </label>
        </div>
      </main>
    </div>
  );
}
