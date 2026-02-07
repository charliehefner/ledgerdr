import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tractor, QrCode, List, Camera, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { QRScanner } from "../QRScanner";
import type { FuelingData } from "../FuelingWizard";

interface TractorStepProps {
  data: Partial<FuelingData>;
  onUpdate: (data: Partial<FuelingData>) => void;
}

type InputMode = "qr" | "list";

export function TractorStep({ data, onUpdate }: TractorStepProps) {
  const [mode, setMode] = useState<InputMode>("qr");
  const [searchQuery, setSearchQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Fetch tractors for manual selection
  const { data: tractors, isLoading } = useQuery({
    queryKey: ["tractors-driver"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTractors = tractors?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleQRScan = (result: { type: string; id: string }) => {
    if (result.type === "tractor") {
      const tractor = tractors?.find(t => t.id === result.id);
      if (tractor) {
        onUpdate({
          tractorId: tractor.id,
          tractorName: tractor.name,
          currentHourMeter: tractor.current_hour_meter || 0,
        });
      }
    }
    setShowScanner(false);
  };

  const handleSelectTractor = (tractor: { id: string; name: string; current_hour_meter: number | null }) => {
    onUpdate({
      tractorId: tractor.id,
      tractorName: tractor.name,
      currentHourMeter: tractor.current_hour_meter || 0,
    });
  };

  if (showScanner) {
    return (
      <QRScanner 
        onScan={handleQRScan} 
        onClose={() => setShowScanner(false)}
        expectedType="tractor"
      />
    );
  }

  return (
    <div className="space-y-4">
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
              Escanea el código QR del tractor
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
              placeholder="Buscar tractor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : filteredTractors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No se encontraron tractores</p>
            ) : (
              filteredTractors.map((tractor) => (
                <Card 
                  key={tractor.id}
                  className={`cursor-pointer transition-colors ${
                    data.tractorId === tractor.id 
                      ? "border-primary bg-primary/5" 
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectTractor(tractor)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="bg-primary/10 rounded-full p-2">
                      <Tractor className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{tractor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Horómetro: {tractor.current_hour_meter?.toLocaleString() || 0} hrs
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Selected tractor display */}
      {data.tractorId && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary rounded-full p-2">
              <Tractor className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-medium text-primary">{data.tractorName}</p>
              <p className="text-sm text-muted-foreground">
                Horómetro actual: {data.currentHourMeter?.toLocaleString()} hrs
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
