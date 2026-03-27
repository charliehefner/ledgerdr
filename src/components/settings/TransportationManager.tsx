import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const TYPE_LABELS: Record<string, { es: string; en: string }> = {
  truck: { es: "Camión", en: "Truck" },
  trailer: { es: "Trailer", en: "Trailer" },
  wagon: { es: "Vagón", en: "Wagon" },
};

export function TransportationManager() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState<string>("");
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["transportation-units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportation_units")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transportation_units").insert({
        name: name.trim(),
        unit_type: unitType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportation-units"] });
      setOpen(false);
      setName("");
      setUnitType("");
      toast({ title: "Unidad agregada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transportation_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportation-units"] });
      toast({ title: "Unidad eliminada" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("transportation_units").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportation-units"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t("Transportation", "Transporte")}</h3>
            <p className="text-sm text-muted-foreground">{t("Manage transportation units", "Gestionar unidades de transporte")}</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> {t("Add", "Agregar")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("New Transportation Unit", "Nueva Unidad de Transporte")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>{t("Name / Identifier", "Nombre / Identificador")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Bigab03", "Ej: Bigab03")} />
              </div>
              <div>
                <Label>{t("Type", "Tipo")}</Label>
                <Select value={unitType || undefined} onValueChange={setUnitType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select type", "Seleccionar tipo")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">{t("Truck", "Camión")}</SelectItem>
                    <SelectItem value="trailer">{t("Trailer", "Trailer")}</SelectItem>
                    <SelectItem value="wagon">{t("Wagon", "Vagón")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !name.trim() || !unitType}
            >
              {t("Save", "Guardar")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Name", "Nombre")}</TableHead>
              <TableHead>{t("Type", "Tipo")}</TableHead>
              <TableHead>{t("Status", "Estado")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("Loading...", "Cargando...")}</TableCell></TableRow>
            ) : units.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("No units", "Sin unidades")}</TableCell></TableRow>
            ) : units.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{TYPE_LABELS[u.unit_type]?.[t("en", "es") as "en" | "es"] || u.unit_type}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.is_active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                  >
                    {u.is_active ? t("Active", "Activo") : t("Inactive", "Inactivo")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(u.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
