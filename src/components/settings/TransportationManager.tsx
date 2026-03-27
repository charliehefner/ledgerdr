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
      toast({ title: t("transport.save") });
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
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("transportation_units").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportation-units"] }),
  });

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      truck: "transport.truck",
      trailer: "transport.trailer",
      wagon: "transport.wagon",
    };
    return map[type] ? t(map[type]) : type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t("transport.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("transport.subtitle")}</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> {t("transport.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("transport.newUnit")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>{t("transport.nameLabel")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("transport.namePlaceholder")} />
              </div>
              <div>
                <Label>{t("transport.typeLabel")}</Label>
                <Select value={unitType || undefined} onValueChange={setUnitType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("transport.typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">{t("transport.truck")}</SelectItem>
                    <SelectItem value="trailer">{t("transport.trailer")}</SelectItem>
                    <SelectItem value="wagon">{t("transport.wagon")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !name.trim() || !unitType}
            >
              {t("transport.save")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("transport.name")}</TableHead>
              <TableHead>{t("transport.type")}</TableHead>
              <TableHead>{t("transport.status")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("transport.loading")}</TableCell></TableRow>
            ) : units.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("transport.noUnits")}</TableCell></TableRow>
            ) : units.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{typeLabel(u.unit_type)}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.is_active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                  >
                    {u.is_active ? t("transport.active") : t("transport.inactive")}
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
