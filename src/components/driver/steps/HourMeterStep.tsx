import { useState } from "react";
import { Camera, Keyboard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MeterPhotoCapture } from "../MeterPhotoCapture";
import type { FuelingData } from "../FuelingWizard";

interface HourMeterStepProps {
  data: Partial<FuelingData>;
  onUpdate: (data: Partial<FuelingData>) => void;
}

export function HourMeterStep({ data, onUpdate }: HourMeterStepProps) {
  const [mode, setMode] = useState<"photo" | "manual">("photo");
  const [showCamera, setShowCamera] = useState(false);

  const isValid = data.hourMeterReading !== undefined && 
    data.hourMeterReading >= (data.currentHourMeter || 0);

  const isBelowCurrent = data.hourMeterReading !== undefined && 
    data.hourMeterReading < (data.currentHourMeter || 0);

  const handlePhotoCapture = async (imageData: string, extractedValue?: number) => {
    onUpdate({
      hourMeterPhoto: imageData,
      hourMeterReading: extractedValue,
    });
    setShowCamera(false);
  };

  const handleManualInput = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdate({ hourMeterReading: numValue });
    } else if (value === "") {
      onUpdate({ hourMeterReading: undefined });
    }
  };

  if (showCamera) {
    return (
      <MeterPhotoCapture
        meterType="hour_meter"
        previousValue={data.currentHourMeter || 0}
        equipmentName={data.tractorName || ""}
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Current reading reference */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Lectura anterior registrada</p>
          <p className="text-2xl font-bold">{data.currentHourMeter?.toLocaleString() || 0} hrs</p>
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
            {data.hourMeterPhoto ? (
              <div className="w-full space-y-3">
                <img 
                  src={data.hourMeterPhoto} 
                  alt="Horómetro" 
                  className="w-full rounded-lg"
                />
                
                {/* Always show input field to enter/correct reading */}
                <div className="space-y-2">
                  <Label htmlFor="hour-meter-photo" className="text-center block">
                    {data.hourMeterReading !== undefined 
                      ? "Lectura detectada (corrija si es necesario):" 
                      : "Ingrese la lectura manualmente:"}
                  </Label>
                  <Input
                    id="hour-meter-photo"
                    type="number"
                    inputMode="decimal"
                    placeholder="Ej: 1234.5"
                    value={data.hourMeterReading ?? ""}
                    onChange={(e) => handleManualInput(e.target.value)}
                    className="text-xl h-14 text-center"
                  />
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
                  Toma una foto clara del horómetro
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
          <Label htmlFor="hour-meter">Nueva lectura del horómetro (hrs)</Label>
          <Input
            id="hour-meter"
            type="number"
            inputMode="decimal"
            placeholder="Ej: 1234.5"
            value={data.hourMeterReading ?? ""}
            onChange={(e) => handleManualInput(e.target.value)}
            className="text-xl h-14 text-center"
          />
        </div>
      )}

      {/* Validation error */}
      {isBelowCurrent && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La lectura debe ser mayor o igual a {data.currentHourMeter?.toLocaleString()} hrs
          </AlertDescription>
        </Alert>
      )}

      {/* Current value display */}
      {data.hourMeterReading !== undefined && isValid && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Nueva lectura</p>
            <p className="text-3xl font-bold text-primary">
              {data.hourMeterReading.toLocaleString()} hrs
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              +{(data.hourMeterReading - (data.currentHourMeter || 0)).toFixed(1)} hrs trabajadas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
