import { Tractor, Fuel, Clock, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FuelingData } from "../FuelingWizard";

interface ReviewStepProps {
  data: Partial<FuelingData>;
}

export function ReviewStep({ data }: ReviewStepProps) {
  const gallonsDispensed = (data.pumpEndReading || 0) - (data.pumpStartReading || 0);
  const hoursWorked = (data.hourMeterReading || 0) - (data.currentHourMeter || 0);
  const gallonsPerHour = hoursWorked > 0 ? gallonsDispensed / hoursWorked : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tractor className="h-5 w-5" />
            Tractor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-lg">{data.tractorName}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Horómetro anterior</p>
              <p className="font-medium">{data.currentHourMeter?.toLocaleString()} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Horómetro nuevo</p>
              <p className="font-medium">{data.hourMeterReading?.toLocaleString()} hrs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Fuel className="h-5 w-5" />
            Tanque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-lg">{data.tankName}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Bomba inicio</p>
              <p className="font-medium">{data.pumpStartReading?.toLocaleString()} gal</p>
            </div>
            <div>
              <p className="text-muted-foreground">Bomba final</p>
              <p className="font-medium">{data.pumpEndReading?.toLocaleString()} gal</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Fuel className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-primary">{gallonsDispensed.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Galones</p>
            </div>
            <div>
              <Clock className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-primary">{hoursWorked.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Horas</p>
            </div>
            <div>
              <Gauge className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-primary">{gallonsPerHour.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Gal/Hr</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photos preview */}
      {(data.hourMeterPhoto || data.pumpStartPhoto || data.pumpEndPhoto) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fotos capturadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {data.hourMeterPhoto && (
                <div>
                  <img 
                    src={data.hourMeterPhoto} 
                    alt="Horómetro" 
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-1">Horómetro</p>
                </div>
              )}
              {data.pumpStartPhoto && (
                <div>
                  <img 
                    src={data.pumpStartPhoto} 
                    alt="Bomba inicio" 
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-1">Inicio</p>
                </div>
              )}
              {data.pumpEndPhoto && (
                <div>
                  <img 
                    src={data.pumpEndPhoto} 
                    alt="Bomba final" 
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <p className="text-xs text-center text-muted-foreground mt-1">Final</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
