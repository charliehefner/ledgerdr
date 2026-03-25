import { useState } from "react";
import { Camera, Keyboard, AlertCircle, CheckCircle2, Gauge, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { MeterPhotoCapture } from "../MeterPhotoCapture";
import { StepHeader } from "../StepHeader";
import type { FuelingData } from "../FuelingWizard";

interface PumpStartStepProps {
  data: Partial<FuelingData>;
  onUpdate: (data: Partial<FuelingData>) => void;
  isAdmin?: boolean;
}

const TOLERANCE = 0.2; // ±0.2 gallons tolerance

export function PumpStartStep({ data, onUpdate, isAdmin = false }: PumpStartStepProps) {
  const [mode, setMode] = useState<"photo" | "manual">("photo");
  const [showCamera, setShowCamera] = useState(false);
  const [hasPreFilled, setHasPreFilled] = useState(false);

  const expectedValue = data.expectedPumpStart || 0;

  // Pre-fill pumpStartReading with expected value on first load
  if (!hasPreFilled && data.pumpStartReading === undefined && expectedValue > 0) {
    setHasPreFilled(true);
    onUpdate({ pumpStartReading: expectedValue });
  }
  const difference = data.pumpStartReading !== undefined 
    ? Math.abs(data.pumpStartReading - expectedValue) 
    : null;
  const isWithinTolerance = difference !== null && difference <= TOLERANCE;
  const isOutOfTolerance = difference !== null && difference > TOLERANCE;

  const handlePhotoCapture = async (imageData: string, extractedValue?: number) => {
    onUpdate({
      pumpStartPhoto: imageData,
      pumpStartReading: extractedValue,
      pumpStartOverride: false,
    });
    setShowCamera(false);
  };

  const handleManualInput = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdate({ pumpStartReading: numValue, pumpStartOverride: false });
    } else if (value === "") {
      onUpdate({ pumpStartReading: undefined, pumpStartOverride: false });
    }
  };

  if (showCamera) {
    return (
      <MeterPhotoCapture
        meterType="fuel_pump"
        previousValue={expectedValue}
        equipmentName={data.tankName || ""}
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Large visual icon for non-readers - Gauge on LEFT for BEFORE fueling */}
      <StepHeader 
        icon={<Gauge className="h-full w-full" />}
        iconPosition="left"
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
      />
      {/* Expected reading reference */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Lectura esperada de la bomba</p>
          <p className="text-2xl font-bold">{expectedValue.toLocaleString()} gal</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tolerancia: ±{TOLERANCE} galones
          </p>
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
            {data.pumpStartPhoto ? (
              <div className="w-full space-y-3">
                <img 
                  src={data.pumpStartPhoto} 
                  alt="Bomba inicio" 
                  className="w-full rounded-lg"
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Lectura detectada:</p>
                  <p className="text-3xl font-bold text-primary">
                    {data.pumpStartReading?.toLocaleString() || "—"} gal
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
                  Foto de la bomba ANTES de cargar
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
          <Label htmlFor="pump-start">Lectura inicial de la bomba (gal)</Label>
          <Input
            id="pump-start"
            type="number"
            inputMode="decimal"
            placeholder="Ej: 5432.1"
            value={data.pumpStartReading ?? ""}
            onChange={(e) => handleManualInput(e.target.value)}
            className="text-xl h-14 text-center"
          />
        </div>
      )}

      {/* Validation feedback */}
      {isWithinTolerance && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✓ Lectura dentro de tolerancia ({difference?.toFixed(2)} gal de diferencia)
          </AlertDescription>
        </Alert>
      )}

      {isOutOfTolerance && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La lectura difiere {difference?.toFixed(2)} gal del valor esperado ({expectedValue.toLocaleString()}).
            {!isAdmin && " Contacte a un administrador para continuar."}
            {isAdmin && " Verifique que está en el tanque correcto."}
          </AlertDescription>
        </Alert>
      )}

      {isOutOfTolerance && isAdmin && (
        <div className="flex items-start space-x-3 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
          <Checkbox
            id="pump-override"
            checked={!!data.pumpStartOverride}
            onCheckedChange={(checked) =>
              onUpdate({ pumpStartOverride: checked === true })
            }
          />
          <div className="space-y-1">
            <Label htmlFor="pump-override" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Override de administrador
            </Label>
            <p className="text-xs text-muted-foreground">
              Confirmo que la lectura de {data.pumpStartReading?.toLocaleString()} gal es correcta a pesar de la diferencia con el valor esperado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
