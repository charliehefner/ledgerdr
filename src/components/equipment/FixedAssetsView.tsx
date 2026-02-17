import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { FixedAssetDialog } from "./FixedAssetDialog";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "vehicle", label: "Vehículo" },
  { value: "tractor", label: "Tractor" },
  { value: "implement", label: "Implemento" },
  { value: "building", label: "Edificio" },
  { value: "tools", label: "Herramientas" },
  { value: "container", label: "Tanque/Contenedor" },
  { value: "office", label: "Oficina" },
  { value: "computer", label: "Computadora" },
  { value: "solar_panel", label: "Panel Solar" },
  { value: "land_improvement", label: "Mejora de Terreno" },
  { value: "other", label: "Otro" },
];

export function FixedAssetsView() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "disposed" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  const { data: assets = [], isLoading, refetch } = useQuery({
    queryKey: ["fixed-assets", categoryFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("fixed_assets")
        .select("*")
        .is("deleted_at", null)
        .order("asset_code");

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }
      if (statusFilter === "active") {
        query = query.eq("is_active", true);
      } else if (statusFilter === "disposed") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(val);

  const getCategoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label || cat;

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingAsset(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="disposed">Dados de baja</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Agregar Activo
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fecha Adquisición</TableHead>
              <TableHead className="text-right">Valor Adquisición</TableHead>
              <TableHead className="text-right">Años</TableHead>
              <TableHead className="text-right">Dep. Acumulada</TableHead>
              <TableHead className="text-right">Valor Neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No hay activos fijos registrados
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset: any) => {
                const netBookValue = Number(asset.acquisition_value) - Number(asset.accumulated_depreciation);
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs">{asset.asset_code}</TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(asset.category)}</Badge>
                    </TableCell>
                    <TableCell>{asset.acquisition_date || "—"}</TableCell>
                    <TableCell className="text-right">
                      {Number(asset.acquisition_value) > 0 ? formatCurrency(Number(asset.acquisition_value)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{asset.useful_life_years}</TableCell>
                    <TableCell className="text-right">
                      {Number(asset.accumulated_depreciation) > 0
                        ? formatCurrency(Number(asset.accumulated_depreciation))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(asset.acquisition_value) > 0 ? formatCurrency(netBookValue) : "—"}
                    </TableCell>
                    <TableCell>
                      {asset.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Baja</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(asset)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <FixedAssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        asset={editingAsset}
        onSaved={refetch}
      />
    </div>
  );
}
