import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserCheck, UserX, Search, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Jornalero {
  id: string;
  name: string;
  cedula: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function JornalerosView() {
  const queryClient = useQueryClient();
  const { canModifySettings } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJornalero, setEditingJornalero] = useState<Jornalero | null>(null);
  const [formData, setFormData] = useState({ name: "", cedula: "" });

  // Fetch jornaleros
  const { data: jornaleros = [], isLoading } = useQuery({
    queryKey: ["jornaleros", showInactive],
    queryFn: async () => {
      let query = supabase
        .from("jornaleros")
        .select("*")
        .order("name", { ascending: true });

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Jornalero[];
    },
  });

  // Add/Update jornalero mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; cedula: string; id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("jornaleros")
          .update({ name: data.name, cedula: data.cedula })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("jornaleros")
          .insert({ name: data.name, cedula: data.cedula });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornaleros"] });
      setIsDialogOpen(false);
      setEditingJornalero(null);
      setFormData({ name: "", cedula: "" });
      toast({ title: editingJornalero ? "Jornalero actualizado" : "Jornalero agregado" });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate key") || error.message?.includes("jornaleros_cedula_key")) {
        toast({ title: "Error", description: "Ya existe un jornalero con esta cédula.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("jornaleros")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jornaleros"] });
      toast({ title: variables.is_active ? "Jornalero activado" : "Jornalero desactivado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredJornaleros = jornaleros.filter((j) =>
    j.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.cedula.includes(searchTerm)
  );

  const handleOpenDialog = (jornalero?: Jornalero) => {
    if (jornalero) {
      setEditingJornalero(jornalero);
      setFormData({ name: jornalero.name, cedula: jornalero.cedula });
    } else {
      setEditingJornalero(null);
      setFormData({ name: "", cedula: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.cedula.trim()) {
      toast({ title: "Complete todos los campos", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      name: formData.name.trim(),
      cedula: formData.cedula.trim(),
      id: editingJornalero?.id,
    });
  };

  const activeCount = jornaleros.filter((j) => j.is_active).length;
  const inactiveCount = jornaleros.filter((j) => !j.is_active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">Registro de Jornaleros</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {activeCount} activos{inactiveCount > 0 && `, ${inactiveCount} inactivos`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showInactive ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? "Ocultar Inactivos" : "Mostrar Inactivos"}
              </Button>
              {canModifySettings && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Jornalero
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o cédula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                {canModifySettings && <TableHead className="w-24 text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredJornaleros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No se encontraron jornaleros" : "No hay jornaleros registrados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredJornaleros.map((jornalero) => (
                  <TableRow key={jornalero.id} className={!jornalero.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{jornalero.name}</TableCell>
                    <TableCell className="font-mono">{jornalero.cedula}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={jornalero.is_active ? "default" : "secondary"}>
                        {jornalero.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {canModifySettings && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(jornalero)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: jornalero.id,
                                is_active: !jornalero.is_active,
                              })
                            }
                            title={jornalero.is_active ? "Desactivar" : "Activar"}
                          >
                            {jornalero.is_active ? (
                              <UserX className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-success" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJornalero ? "Editar Jornalero" : "Agregar Jornalero"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre completo"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cédula *</label>
              <Input
                value={formData.cedula}
                onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                placeholder="000-0000000-0"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : editingJornalero ? "Actualizar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
