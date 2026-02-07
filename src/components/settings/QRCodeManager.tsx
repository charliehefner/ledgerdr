import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Tractor, Fuel, FileDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCard } from "@/components/qr/QRCodeCard";
import { QRCodeBatchPrint } from "@/components/qr/QRCodeBatchPrint";

export function QRCodeManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [batchType, setBatchType] = useState<"tractors" | "tanks" | "all">("all");

  // Fetch tractors
  const { data: tractors, isLoading: tractorsLoading } = useQuery({
    queryKey: ["tractors-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter, hp, brand")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tanks
  const { data: tanks, isLoading: tanksLoading } = useQuery({
    queryKey: ["tanks-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, capacity_gallons, use_type")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = tractorsLoading || tanksLoading;

  const filteredTractors = tractors?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredTanks = tanks?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleBatchPrint = (type: "tractors" | "tanks" | "all") => {
    setBatchType(type);
    setShowBatchPrint(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with batch print options */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleBatchPrint("tractors")}>
            <Tractor className="mr-2 h-4 w-4" />
            Imprimir Tractores
          </Button>
          <Button variant="outline" onClick={() => handleBatchPrint("tanks")}>
            <Fuel className="mr-2 h-4 w-4" />
            Imprimir Tanques
          </Button>
          <Button onClick={() => handleBatchPrint("all")}>
            <FileDown className="mr-2 h-4 w-4" />
            Imprimir Todos
          </Button>
        </div>
      </div>

      {/* Tabs for tractors and tanks */}
      <Tabs defaultValue="tractors">
        <TabsList>
          <TabsTrigger value="tractors" className="gap-2">
            <Tractor className="h-4 w-4" />
            Tractores ({filteredTractors.length})
          </TabsTrigger>
          <TabsTrigger value="tanks" className="gap-2">
            <Fuel className="h-4 w-4" />
            Tanques ({filteredTanks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tractors" className="mt-4">
          {filteredTractors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No se encontraron tractores
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTractors.map((tractor) => (
                <QRCodeCard
                  key={tractor.id}
                  type="tractor"
                  id={tractor.id}
                  name={tractor.name}
                  subtitle={[tractor.brand, tractor.hp ? `${tractor.hp} HP` : null]
                    .filter(Boolean)
                    .join(" • ")}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tanks" className="mt-4">
          {filteredTanks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No se encontraron tanques
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTanks.map((tank) => (
                <QRCodeCard
                  key={tank.id}
                  type="tank"
                  id={tank.id}
                  name={tank.name}
                  subtitle={`${tank.capacity_gallons.toLocaleString()} gal • ${
                    tank.use_type === "agriculture" ? "Agrícola" : "Industrial"
                  }`}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Batch print dialog */}
      {showBatchPrint && (
        <QRCodeBatchPrint
          type={batchType}
          tractors={batchType !== "tanks" ? tractors || [] : []}
          tanks={batchType !== "tractors" ? tanks || [] : []}
          onClose={() => setShowBatchPrint(false)}
        />
      )}
    </div>
  );
}
