import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CIP_ACCOUNTS = [
  { code: "1080", label: "1080 — Anticipos / intangibles en curso" },
  { code: "1180", label: "1180 — Construcción en curso (terrenos / edificios)" },
  { code: "1280", label: "1280 — Maquinaria y equipo en curso" },
];

interface CipProps {
  highlightCapId?: string | null;
}

export function CipProjectsView({ highlightCapId }: CipProps = {}) {
  const { user } = useAuth();
  const { selectedEntityId, requireEntity } = useEntity();
  const qc = useQueryClient();
  const role = user?.role;
  const canWrite = role === "admin" || role === "management" || role === "accountant";

  const [createOpen, setCreateOpen] = useState(false);
  const [capProject, setCapProject] = useState<any | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["cip-projects", selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("cip_projects")
        .select("id, name, cip_account_code, status, placed_in_service_date, description, entity_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Compute running balance per project from journal_lines via home_office_advances aggregate
  const { data: balances = {} } = useQuery({
    queryKey: ["cip-balances", projects.map((p) => p.id).join(",")],
    queryFn: async () => {
      const ids = projects.filter((p) => p.status === "open").map((p) => p.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("home_office_advances")
        .select("cip_project_id, amount_dop")
        .in("cip_project_id", ids)
        .neq("status", "voided");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        if (r.cip_project_id) map[r.cip_project_id] = (map[r.cip_project_id] || 0) + Number(r.amount_dop);
      });
      return map;
    },
    enabled: projects.length > 0,
  });

  // Latest activity per project (used for 12-month idle impairment notice)
  const { data: lastActivity = {} } = useQuery({
    queryKey: ["cip-last-activity", projects.map((p) => p.id).join(",")],
    queryFn: async () => {
      const ids = projects.filter((p) => p.status === "open").map((p) => p.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("home_office_advances")
        .select("cip_project_id, advance_date")
        .in("cip_project_id", ids)
        .neq("status", "voided")
        .order("advance_date", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (r.cip_project_id && !map[r.cip_project_id]) map[r.cip_project_id] = r.advance_date;
      });
      return map;
    },
    enabled: projects.length > 0,
  });

  const isStale = (projectId: string) => {
    const last = lastActivity[projectId];
    if (!last) return false;
    const lastDate = new Date(last);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    return lastDate < cutoff;
  };

  const staleProjects = projects.filter((p) => p.status === "open" && isStale(p.id));

  return (
    <div className="space-y-6">
      {staleProjects.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-100">
          <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Posible deterioro</div>
            <div className="text-xs mt-0.5">
              {staleProjects.length === 1
                ? `El proyecto "${staleProjects[0].name}" no ha tenido actividad en más de 12 meses.`
                : `${staleProjects.length} proyectos sin actividad en más de 12 meses.`}{" "}
              Si fueron abandonados o sufrieron retrasos significativos, revise el saldo para deterioro y dé de baja los costos no recuperables.
            </div>
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Proyectos en curso (CIP)
          </CardTitle>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nuevo proyecto
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cuenta CIP</TableHead>
                <TableHead className="text-right">Saldo acumulado (DOP)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Puesto en servicio</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && projects.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin proyectos CIP</TableCell></TableRow>
              )}
              {projects.map((p) => (
                <TableRow key={p.id} className={highlightCapId === p.id ? "bg-yellow-50 dark:bg-yellow-950/20 ring-2 ring-yellow-400/60" : ""}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.cip_account_code}</Badge></TableCell>
                  <TableCell className="text-right font-mono">
                    {(balances[p.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "open" ? "default" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>{p.placed_in_service_date ? format(new Date(p.placed_in_service_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && p.status === "open" && (balances[p.id] || 0) > 0 && (
                      <Button size="sm" onClick={() => setCapProject(p)}>Capitalizar</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateCipDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CapitalizeCipDialog project={capProject} onClose={() => setCapProject(null)} />
    </div>
  );
}

function CreateCipDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { requireEntity } = useEntity();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("1280");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione una entidad.");
      const { error } = await supabase.from("cip_projects").insert({
        name,
        cip_account_code: code,
        description: description || null,
        entity_id: entityId,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proyecto creado");
      qc.invalidateQueries({ queryKey: ["cip-projects"] });
      qc.invalidateQueries({ queryKey: ["ho-cip-projects"] });
      setName(""); setDescription("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto CIP</DialogTitle>
          <DialogDescription>Acumula costos antes de capitalizar como activo fijo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cuenta CIP</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CIP_ACCOUNTS.map((a) => <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapitalizeCipDialog({ project, onClose }: { project: any | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [assetName, setAssetName] = useState("");
  const [serial, setSerial] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const [pisDate, setPisDate] = useState<Date>(new Date());
  const [usefulLife, setUsefulLife] = useState("60");
  const [salvage, setSalvage] = useState("0");

  const open = !!project;

  const { data: assetAccounts = [] } = useQuery({
    queryKey: ["fa-asset-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("account_code, account_name")
        .eq("account_type", "ASSET")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const cap = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project");
      const { error } = await supabase.rpc("capitalize_cip_project", {
        p_cip_project_id: project.id,
        p_target_asset_account_code: targetCode,
        p_placed_in_service_date: format(pisDate, "yyyy-MM-dd"),
        p_useful_life_months: Number(usefulLife),
        p_salvage_value: Number(salvage),
        p_user_id: user!.id,
        p_asset_name: assetName,
        p_serial_number: serial || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proyecto capitalizado a activo fijo.");
      qc.invalidateQueries({ queryKey: ["cip-projects"] });
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capitalizar {project?.name}</DialogTitle>
          <DialogDescription>
            Crea el activo fijo y postea Dr [activo] / Cr {project?.cip_account_code}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Nombre del activo</Label>
            <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Serie / placa</Label>
              <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cuenta de activo (destino)</Label>
              <Select value={targetCode} onValueChange={setTargetCode}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.account_code} value={a.account_code}>
                      {a.account_code} — {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Puesto en servicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(pisDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={pisDate} onSelect={(d) => d && setPisDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Vida útil (meses)</Label>
              <Input type="number" value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor residual</Label>
              <Input type="number" step="0.01" value={salvage} onChange={(e) => setSalvage(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">Método de depreciación: Línea recta</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => cap.mutate()}
            disabled={!assetName || !targetCode || cap.isPending}
          >
            {cap.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Capitalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
