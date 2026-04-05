import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Calculator } from "lucide-react";
import { FixedAssetDialog } from "./FixedAssetDialog";
import { useDepreciationGeneration } from "./useDepreciationGeneration";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { toast } from "@/hooks/use-toast";

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
  const [editingAsset, setEditingAsset] = useState<Record<string, unknown> | null>(null);
  const [depDialogOpen, setDepDialogOpen] = useState(false);
  const [depMonth, setDepMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [depFrequency, setDepFrequency] = useState<"monthly" | "quarterly">("monthly");
  const [depResult, setDepResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const queryClient = useQueryClient();
  const { generate, generating, progress, total } = useDepreciationGeneration();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();

  const { data: assets = [], isLoading, refetch } = useQuery({
    queryKey: ["fixed-assets", categoryFilter, statusFilter, selectedEntityId],
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

      if (selectedEntityId) {
        query = query.eq("entity_id", selectedEntityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
      return data;
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(val);

  const getCategoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label || cat;

  const handleEdit = (asset: Record<string, unknown>) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingAsset(null);
    setDialogOpen(true);
  };

  const handleGenerateDepreciation = async () => {
    const [yearStr, monthStr] = depMonth.split("-");
    const result = await generate(parseInt(yearStr), parseInt(monthStr), depFrequency);
    setDepResult(result);
    queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
    queryClient.invalidateQueries({ queryKey: ["journals"] });
    if (result.created > 0) {
      toast({ title: "Depreciación generada", description: `${result.created} asiento(s) creado(s), ${result.skipped} omitido(s).` });
    }
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

        <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as "active" | "disposed" | "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="disposed">Dados de baja</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button onClick={() => { setDepResult(null); setDepDialogOpen(true); }} size="sm" variant="outline">
            <Calculator className="h-4 w-4 mr-1" /> Generar Depreciación
          </Button>
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
              assets.map((asset) => {
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

      {/* Depreciation Generation Dialog */}
      <Dialog open={depDialogOpen} onOpenChange={setDepDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar Depreciación</DialogTitle>
            <DialogDescription>
              Calcula depreciación línea recta y crea asientos DEP como borradores.
            </DialogDescription>
          </DialogHeader>

          {!generating && !depResult && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Período</label>
                <input
                  type="month"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={depMonth}
                  onChange={(e) => setDepMonth(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Frecuencia</label>
                <Select value={depFrequency} onValueChange={(v) => setDepFrequency(v as "monthly" | "quarterly")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="quarterly">Trimestral (3× mensual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {generating && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                Procesando {progress} de {total} activos...
              </p>
              <Progress value={total > 0 ? (progress / total) * 100 : 0} />
            </div>
          )}

          {depResult && !generating && (
            <div className="space-y-2 py-2">
              <p className="text-sm">✅ Creados: <strong>{depResult.created}</strong></p>
              <p className="text-sm">⏭️ Omitidos: <strong>{depResult.skipped}</strong></p>
              {depResult.errors.length > 0 && (
                <div className="text-sm text-destructive space-y-1">
                  <p>❌ Errores:</p>
                  {depResult.errors.map((e, i) => (
                    <p key={i} className="text-xs ml-2">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!generating && !depResult && (
              <>
                <Button variant="outline" onClick={() => setDepDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleGenerateDepreciation}>Generar</Button>
              </>
            )}
            {depResult && (
              <Button onClick={() => setDepDialogOpen(false)}>Cerrar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
