import { useState, useRef } from "react";
import { X, Camera, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface MeterPhotoCaptureProps {
  meterType: "hour_meter" | "fuel_pump";
  previousValue: number;
  equipmentName: string;
  onCapture: (imageData: string, extractedValue?: number) => void;
  onClose: () => void;
}

export function MeterPhotoCapture({ 
  meterType, 
  previousValue, 
  equipmentName,
  onCapture, 
  onClose 
}: MeterPhotoCaptureProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [extractedValue, setExtractedValue] = useState<number | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [manualValue, setManualValue] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImageData(base64);
      
      // Try to analyze with AI
      await analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("analyze-meter-image", {
        body: {
          image: base64,
          meterType,
          previousValue,
          equipmentName,
        },
      });

      if (error) throw error;

      if (data?.extractedValue !== undefined) {
        setExtractedValue(data.extractedValue);
        setManualValue(data.extractedValue.toString());
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
      // Fail silently - user can enter manually
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = () => {
    if (!imageData) return;
    
    const value = manualValue ? parseFloat(manualValue) : extractedValue;
    onCapture(imageData, value);
  };

  const handleRetake = () => {
    setImageData(null);
    setExtractedValue(undefined);
    setManualValue("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleManualChange = (value: string) => {
    setManualValue(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setExtractedValue(num);
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
            {meterType === "hour_meter" ? "Horómetro" : "Bomba de Combustible"}
          </p>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Reference value */}
        <Card className="bg-muted/50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">Lectura anterior</p>
            <p className="text-xl font-bold">{previousValue.toLocaleString()}</p>
          </CardContent>
        </Card>

        {imageData ? (
          <div className="space-y-4">
            {/* Image preview */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <img 
                  src={imageData} 
                  alt="Captura" 
                  className="w-full"
                />
              </CardContent>
            </Card>

            {/* Analysis result / Manual input */}
            <div className="space-y-3">
              <Label>
                {isAnalyzing ? "Analizando imagen..." : "Lectura detectada"}
              </Label>
              
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  value={manualValue}
                  onChange={(e) => handleManualChange(e.target.value)}
                  placeholder="Ingrese la lectura"
                  className="text-xl h-14 text-center"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRetake} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tomar otra
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={isAnalyzing || !manualValue}
                className="flex-1"
              >
                Confirmar
              </Button>
            </div>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="bg-primary/10 rounded-full p-6 mb-4">
                <Camera className="h-12 w-12 text-primary" />
              </div>
              <p className="text-center text-muted-foreground mb-4">
                Toma una foto clara del{" "}
                {meterType === "hour_meter" ? "horómetro" : "medidor de la bomba"}
              </p>
              
              <label>
                <Button asChild>
                  <span>
                    <Camera className="mr-2 h-4 w-4" />
                    Abrir Cámara
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </span>
                </Button>
              </label>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
