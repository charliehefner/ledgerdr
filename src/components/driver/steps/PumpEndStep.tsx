import { useState } from "react";
import { Camera, Keyboard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MeterPhotoCapture } from "../MeterPhotoCapture";
import type { FuelingData } from "../FuelingWizard";

interface PumpEndStepProps {
  data: Partial<FuelingData>;
  onUpdate: (data: Partial<FuelingData>) => void;
}

export function PumpEndStep({ data, onUpdate }: PumpEndStepProps) {
  const [mode, setMode] = useState<"photo" | "manual">("photo");
  const [showCamera, setShowCamera] = useState(false);

  const startReading = data.pumpStartReading || 0;
  const gallonsDispensed = data.pumpEndReading !== undefined 
    ? data.pumpEndReading - startReading 
    : null;
  const isValid = gallonsDispensed !== null && gallonsDispensed > 0;
  const isNegative = gallonsDispensed !== null && gallonsDispensed <= 0;

  const handlePhotoCapture = async (imageData: string, extractedValue?: number) => {
    onUpdate({
      pumpEndPhoto: imageData,
      pumpEndReading: extractedValue,
    });
    setShowCamera(false);
  };

  const handleManualInput = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdate({ pumpEndReading: numValue });
    } else if (value === "") {
      onUpdate({ pumpEndReading: undefined });
    }
  };

  if (showCamera) {
    return (
      <MeterPhotoCapture
        meterType="fuel_pump"
        previousValue={startReading}
        equipmentName={data.tankName || ""}
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Start reading reference */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Lectura inicial</p>
          <p className="text-2xl font-bold">{startReading.toLocaleString()} gal</p>
        </CardContent>
      </Card>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "photo" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("photo")}
        >
          <Camera className="mr-2 h-4 w-4" />
          Foto
        </Button>
        <Button
          variant={mode === "manual" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("manual")}
        >
          <Keyboard className="mr-2 h-4 w-4" />
          Manual
        </Button>
      </div>

      {mode === "photo" ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            {data.pumpEndPhoto ? (
              <div className="w-full space-y-3">
                <img 
                  src={data.pumpEndPhoto} 
                  alt="Bomba final" 
                  className="w-full rounded-lg"
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Lectura detectada:</p>
                  <p className="text-3xl font-bold text-primary">
                    {data.pumpEndReading?.toLocaleString() || "—"} gal
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowCamera(true)}
                >
                  Tomar otra foto
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-primary/10 rounded-full p-6 mb-4">
                  <Camera className="h-12 w-12 text-primary" />
                </div>
                <p className="text-center text-muted-foreground mb-4">
                  Foto de la bomba DESPUÉS de cargar
                </p>
                <Button onClick={() => setShowCamera(true)}>
                  <Camera className="mr-2 h-4 w-4" />
                  Abrir Cámara
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="pump-end">Lectura final de la bomba (gal)</Label>
          <Input
            id="pump-end"
            type="number"
            inputMode="decimal"
            placeholder="Ej: 5467.3"
            value={data.pumpEndReading ?? ""}
            onChange={(e) => handleManualInput(e.target.value)}
            className="text-xl h-14 text-center"
          />
        </div>
      )}

      {/* Validation error */}
      {isNegative && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La lectura final debe ser mayor que la lectura inicial ({startReading.toLocaleString()} gal)
          </AlertDescription>
        </Alert>
      )}

      {/* Gallons dispensed display */}
      {isValid && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Galones dispensados</p>
            <p className="text-4xl font-bold text-primary">
              {gallonsDispensed?.toFixed(1)} gal
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
