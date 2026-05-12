import { useState, useMemo } from "react";
import { parseDateLocal } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ColumnSelector } from "@/components/ui/column-selector";
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";

interface Implement {
  id: string;
  name: string;
  implement_type: string;
  is_active: boolean;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
}

const implementTypes = [
  "Disk Harrow",
  "Harvest",
  "Plow",
  "Cultivator",
  "Sprayer",
  "Mower",
  "Planter",
  "Seeder",
  "Fertilizer Spreader",
  "Loader",
  "Trailer",
  "Other",
];

export function ImplementsView() {
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingImplement, setEditingImplement] = useState<Implement | null>(null);
  const [form, setForm] = useState({
    name: "",
    implement_type: "",
    serial_number: "",
    brand: "",
    model: "",
    purchase_date: "",
    purchase_price: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { requireEntity } = useEntity();

  const implementColumns: ColumnConfig[] = useMemo(() => [
    { key: "name", label: t("equipment.col.name"), defaultVisible: true },
    { key: "type", label: t("equipment.col.type"), defaultVisible: true },
    { key: "brand_model", label: t("equipment.col.brandModel"), defaultVisible: true },
    { key: "serial", label: t("equipment.col.serial"), defaultVisible: true },
    { key: "purchase_date", label: t("equipment.col.purchaseDate"), defaultVisible: false },
    { key: "price", label: t("equipment.col.price"), defaultVisible: false },
    { key: "status", label: t("equipment.col.status"), defaultVisible: true },
    { key: "actions", label: t("equipment.col.actions"), defaultVisible: true },
  ], [t]);

  const {
    visibility,
    toggleColumn,
    resetToDefaults,
    isVisible,
    allColumns,
  } = useColumnVisibility("implements", implementColumns);

  const { data: implements_, isLoading } = useQuery({
    queryKey: ["implements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implements")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Implement[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record = {
        name: data.name,
        implement_type: data.implement_type,
        serial_number: data.serial_number || null,
        brand: data.brand || null,
        model: data.model || null,
        purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : null,
      };

      if (editingImplement) {
        const { error } = await supabase
          .from("implements")
          .update(record)
          .eq("id", editingImplement.id);
        if (error) throw error;
      } else {
        const entityId = requireEntity();
        if (!entityId) throw new Error("Selecciona una entidad antes de crear");
        const { error } = await supabase.from("implements").insert({ ...record, entity_id: entityId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["implements"] });
      toast({
        title: editingImplement ? t("equipment.implementUpdated") : t("equipment.implementAdded"),
        description: `${form.name} ${t("equipment.successMessage").replace("{action}", editingImplement ? t("equipment.update").toLowerCase() : t("common.add").toLowerCase())}`,
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (implement: Implement) => {
    setEditingImplement(implement);
    setForm({
      name: implement.name,
      implement_type: implement.implement_type,
      serial_number: implement.serial_number || "",
      brand: implement.brand || "",
      model: implement.model || "",
      purchase_date: implement.purchase_date || "",
      purchase_price: implement.purchase_price?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingImplement(null);
    setForm({
      name: "",
      implement_type: "",
      serial_number: "",
      brand: "",
      model: "",
      purchase_date: "",
      purchase_price: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.implement_type) {
      toast({
        title: t("equipment.validationError"),
        description: t("equipment.completeRequired"),
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-center py-8">{t("equipment.loadingImplements")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("equipment.implements")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSelector
            columns={allColumns}
            visibility={visibility}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("equipment.addImplement")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingImplement ? t("equipment.editImplement") : t("equipment.addNewImplement")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>{t("equipment.implementName")} *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="ej. Rastra de Discos 20ft"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>{t("equipment.form.type")} *</Label>
                    <Select
                      value={form.implement_type}
                      onValueChange={(value) => setForm({ ...form, implement_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {implementTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t("equipment.form.brand")}</Label>
                    <Input
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      placeholder="ej. Case IH"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.model")}</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="ej. RMX340"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>{t("equipment.form.serialNumber")}</Label>
                    <Input
                      value={form.serial_number}
                      onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                      placeholder="ej. ABCD1234567"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.purchaseDate")}</Label>
                    <Input
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.purchasePrice")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.purchase_price}
                      onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                      placeholder="ej. 25000"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? t("equipment.saving") : editingImplement ? t("equipment.update") : t("equipment.addImplement")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!implements_ || implements_.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("equipment.noImplements")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isVisible("name") && <TableHead>{t("equipment.col.name")}</TableHead>}
                {isVisible("type") && <TableHead>{t("equipment.col.type")}</TableHead>}
                {isVisible("brand_model") && <TableHead>{t("equipment.col.brandModel")}</TableHead>}
                {isVisible("serial") && <TableHead>{t("equipment.col.serial")}</TableHead>}
                {isVisible("purchase_date") && <TableHead>{t("equipment.col.purchaseDate")}</TableHead>}
                {isVisible("price") && <TableHead>{t("equipment.col.price")}</TableHead>}
                {isVisible("status") && <TableHead>{t("equipment.col.status")}</TableHead>}
                {isVisible("actions") && <TableHead className="w-[80px]">{t("equipment.col.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {implements_.map((implement) => (
                <TableRow key={implement.id}>
                  {isVisible("name") && <TableCell className="font-medium">{implement.name}</TableCell>}
                  {isVisible("type") && (
                    <TableCell>
                      <Badge variant="outline">{implement.implement_type}</Badge>
                    </TableCell>
                  )}
                  {isVisible("brand_model") && (
                    <TableCell>
                      {implement.brand || implement.model
                        ? `${implement.brand || ""} ${implement.model || ""}`.trim()
                        : "-"}
                    </TableCell>
                  )}
                  {isVisible("serial") && <TableCell>{implement.serial_number || "-"}</TableCell>}
                  {isVisible("purchase_date") && (
                    <TableCell>
                      {implement.purchase_date
                        ? format(parseDateLocal(implement.purchase_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                  )}
                  {isVisible("price") && (
                    <TableCell>
                      {implement.purchase_price
                        ? `$${implement.purchase_price.toLocaleString()}`
                        : "-"}
                    </TableCell>
                  )}
                  {isVisible("status") && (
                    <TableCell>
                      <Badge variant={implement.is_active ? "default" : "secondary"}>
                        {implement.is_active ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </TableCell>
                  )}
                  {isVisible("actions") && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(implement)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
