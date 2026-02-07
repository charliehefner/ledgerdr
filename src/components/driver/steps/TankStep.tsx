import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Fuel as FuelIcon, QrCode, List, Camera, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { QRScanner } from "../QRScanner";
import { StepHeader } from "../StepHeader";
import type { FuelingData } from "../FuelingWizard";

interface TankStepProps {
  data: Partial<FuelingData>;
  onUpdate: (data: Partial<FuelingData>) => void;
}

type InputMode = "qr" | "list";

export function TankStep({ data, onUpdate }: TankStepProps) {
  const [mode, setMode] = useState<InputMode>("qr");
  const [searchQuery, setSearchQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Fetch agriculture tanks for driver
  const { data: tanks, isLoading } = useQuery({
    queryKey: ["tanks-driver"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, last_pump_end_reading, current_level_gallons")
        .eq("use_type", "agriculture")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTanks = tanks?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleQRScan = (result: { type: string; id: string }) => {
    if (result.type === "tank") {
      const tank = tanks?.find(t => t.id === result.id);
      if (tank) {
        onUpdate({
          tankId: tank.id,
          tankName: tank.name,
          expectedPumpStart: tank.last_pump_end_reading || 0,
        });
      }
    }
    setShowScanner(false);
  };

  const handleSelectTank = (tank: { id: string; name: string; last_pump_end_reading: number | null }) => {
    onUpdate({
      tankId: tank.id,
      tankName: tank.name,
      expectedPumpStart: tank.last_pump_end_reading || 0,
    });
  };

  if (showScanner) {
    return (
      <QRScanner 
        onScan={handleQRScan} 
        onClose={() => setShowScanner(false)}
        expectedType="tank"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Large visual icon for non-readers */}
      <StepHeader 
        icon={<FuelIcon className="h-full w-full" />}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-100"
      />
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "qr" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("qr")}
        >
          <QrCode className="mr-2 h-4 w-4" />
          Escanear QR
        </Button>
        <Button
          variant={mode === "list" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("list")}
        >
          <List className="mr-2 h-4 w-4" />
          Lista
        </Button>
      </div>

      {mode === "qr" ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-primary/10 rounded-full p-6 mb-4">
              <Camera className="h-12 w-12 text-primary" />
            </div>
            <p className="text-center text-muted-foreground mb-4">
              Escanea el código QR del tanque
            </p>
            <Button onClick={() => setShowScanner(true)}>
              <Camera className="mr-2 h-4 w-4" />
              Abrir Cámara
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tanque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : filteredTanks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No se encontraron tanques</p>
            ) : (
              filteredTanks.map((tank) => (
                <Card 
                  key={tank.id}
                  className={`cursor-pointer transition-colors ${
                    data.tankId === tank.id 
                      ? "border-primary bg-primary/5" 
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectTank(tank)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="bg-primary/10 rounded-full p-2">
                      <FuelIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{tank.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Bomba: {tank.last_pump_end_reading?.toLocaleString() || 0} gal
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Selected tank display */}
      {data.tankId && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary rounded-full p-2">
              <FuelIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-medium text-primary">{data.tankName}</p>
              <p className="text-sm text-muted-foreground">
                Lectura esperada: {data.expectedPumpStart?.toLocaleString()} gal
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
