import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TractorStep } from "./steps/TractorStep";
import { HourMeterStep } from "./steps/HourMeterStep";
import { TankStep } from "./steps/TankStep";
import { PumpStartStep } from "./steps/PumpStartStep";
import { PumpEndStep } from "./steps/PumpEndStep";
import { ReviewStep } from "./steps/ReviewStep";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { toast } from "@/hooks/use-toast";

interface FuelingWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

export interface FuelingData {
  tractorId: string;
  tractorName: string;
  currentHourMeter: number;
  hourMeterReading: number;
  hourMeterPhoto?: string;
  tankId: string;
  tankName: string;
  expectedPumpStart: number;
  pumpStartReading: number;
  pumpStartPhoto?: string;
  pumpEndReading: number;
  pumpEndPhoto?: string;
}

const STEPS = [
  { id: "tractor", title: "Tractor" },
  { id: "hour-meter", title: "Horómetro" },
  { id: "tank", title: "Tanque" },
  { id: "pump-start", title: "Bomba Inicio" },
  { id: "pump-end", title: "Bomba Final" },
  { id: "review", title: "Revisar" },
];

export function FuelingWizard({ onClose, onComplete }: FuelingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Partial<FuelingData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addSubmission } = useOfflineQueue();
  const queryClient = useQueryClient();

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: // Tractor
        return !!data.tractorId;
      case 1: // Hour meter
        return !!data.hourMeterReading && data.hourMeterReading >= (data.currentHourMeter || 0);
      case 2: // Tank
        return !!data.tankId;
      case 3: // Pump start
        return data.pumpStartReading !== undefined;
      case 4: // Pump end
        return data.pumpEndReading !== undefined && data.pumpEndReading > (data.pumpStartReading || 0);
      case 5: // Review
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!data.tractorId || !data.tankId || !data.hourMeterReading || 
        data.pumpStartReading === undefined || data.pumpEndReading === undefined) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const gallons = data.pumpEndReading - data.pumpStartReading;
      
      await addSubmission({
        tractorId: data.tractorId,
        tractorName: data.tractorName || "",
        tankId: data.tankId,
        tankName: data.tankName || "",
        hourMeterReading: data.hourMeterReading,
        previousHourMeter: data.currentHourMeter || 0,
        pumpStartReading: data.pumpStartReading,
        pumpEndReading: data.pumpEndReading,
        gallons,
        photos: {
          hourMeter: data.hourMeterPhoto,
          pumpStart: data.pumpStartPhoto,
          pumpEnd: data.pumpEndPhoto,
        },
      });

      toast({
        title: "Registro guardado",
        description: `${gallons.toFixed(1)} galones registrados`,
      });
      
      // Invalidate queries to ensure fresh data on next wizard open
      await queryClient.invalidateQueries({ queryKey: ["tractors-driver"] });
      await queryClient.invalidateQueries({ queryKey: ["tanks-driver"] });
      
      onComplete();
    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el registro",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateData = (updates: Partial<FuelingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <TractorStep data={data} onUpdate={updateData} />;
      case 1:
        return <HourMeterStep data={data} onUpdate={updateData} />;
      case 2:
        return <TankStep data={data} onUpdate={updateData} />;
      case 3:
        return <PumpStartStep data={data} onUpdate={updateData} />;
      case 4:
        return <PumpEndStep data={data} onUpdate={updateData} />;
      case 5:
        return <ReviewStep data={data} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="font-medium">{STEPS[currentStep].title}</p>
            <p className="text-xs text-muted-foreground">
              Paso {currentStep + 1} de {STEPS.length}
            </p>
          </div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
        <Progress value={progress} className="h-1" />
      </header>

      {/* Content */}
      <main className="p-4 pb-24 overflow-y-auto" style={{ height: "calc(100vh - 140px)" }}>
        {renderStep()}
      </main>

      {/* Footer with navigation buttons */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={handleBack}
              className="flex-1"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Atrás
            </Button>
          )}
          
          {currentStep < STEPS.length - 1 ? (
            <Button 
              size="lg" 
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1"
            >
              Siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              size="lg" 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
