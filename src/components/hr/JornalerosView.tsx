import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserCheck, UserX, Search, Users, FileImage, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteHrTab } from "@/lib/permissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { uploadCedula, getCedulaSignedUrl } from "@/lib/cedulaAttachments";
import { CedulaUploadCell } from "./CedulaUploadCell";

interface Jornalero {
  id: string;
  name: string;
  apodo: string | null;
  cedula: string;
  is_active: boolean;
  cedula_attachment_url: string | null;
  created_at: string;
  updated_at: string;
}

export function JornalerosView() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { requireEntity } = useEntity();
  const canWrite = canWriteHrTab(user?.role, "jornaleros");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJornalero, setEditingJornalero] = useState<Jornalero | null>(null);
  const [formData, setFormData] = useState({ name: "", apodo: "", cedula: "" });
  const [cedulaFile, setCedulaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; apodo: string; cedula: string; id?: string; file: File | null }) => {
      let recordId = data.id;
      if (recordId) {
        const { error } = await supabase
          .from("jornaleros")
          .update({ name: data.name, apodo: data.apodo || null, cedula: data.cedula })
          .eq("id", recordId);
        if (error) throw error;
      } else {
        const entityId = requireEntity();
        if (!entityId) throw new Error(t("jornaleros.entityRequired"));
        const { data: inserted, error } = await supabase
          .from("jornaleros")
          .insert({ name: data.name, apodo: data.apodo || null, cedula: data.cedula, entity_id: entityId })
          .select("id")
          .single();
        if (error) throw error;
        recordId = inserted!.id as string;
      }
      if (data.file && recordId) {
        setUploading(true);
        const { path, error } = await uploadCedula(data.file, "jornalero", recordId);
        setUploading(false);
        if (error) throw new Error(error);
        await supabase
          .from("jornaleros")
          .update({ cedula_attachment_url: path })
          .eq("id", recordId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornaleros"] });
      setIsDialogOpen(false);
      setEditingJornalero(null);
      setFormData({ name: "", apodo: "", cedula: "" });
      setCedulaFile(null);
      toast({ title: editingJornalero ? t("jornaleros.updated") : t("jornaleros.added") });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate key") || error.message?.includes("jornaleros_cedula_key")) {
        toast({ title: t("common.delete"), description: t("jornaleros.duplicateError"), variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const handleViewCedula = async (path: string | null) => {
    if (!path) return;
    const url = await getCedulaSignedUrl(path);
    if (url) window.open(url, "_blank");
    else toast({ title: "Error", description: "No se pudo cargar la cédula", variant: "destructive" });
  };
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
      toast({ title: variables.is_active ? t("jornaleros.activated") : t("jornaleros.deactivated") });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredJornaleros = jornaleros.filter((j) =>
    j.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (j.apodo && j.apodo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    j.cedula.includes(searchTerm)
  );

  const handleOpenDialog = (jornalero?: Jornalero) => {
    if (jornalero) {
      setEditingJornalero(jornalero);
      setFormData({ name: jornalero.name, apodo: jornalero.apodo || "", cedula: jornalero.cedula });
    } else {
      setEditingJornalero(null);
      setFormData({ name: "", apodo: "", cedula: "" });
    }
    setCedulaFile(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.cedula.trim()) {
      toast({ title: t("jornaleros.completeFields"), variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      name: formData.name.trim(),
      apodo: formData.apodo.trim(),
      cedula: formData.cedula.trim(),
      id: editingJornalero?.id,
      file: cedulaFile,
    });
  };
  const activeCount = jornaleros.filter((j) => j.is_active).length;
  const inactiveCount = jornaleros.filter((j) => !j.is_active).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">{t("jornaleros.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("jornaleros.activeCount").replace("{active}", String(activeCount))}
                  {inactiveCount > 0 && t("jornaleros.inactiveCount").replace("{inactive}", String(inactiveCount))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showInactive ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? t("jornaleros.hideInactive") : t("jornaleros.showInactive")}
              </Button>
              {canWrite && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("jornaleros.addButton")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("jornaleros.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.cedula")}</TableHead>
                <TableHead className="text-center">Cédula (foto)</TableHead>
                <TableHead className="text-center">{t("common.status")}</TableHead>
                {canWrite && <TableHead className="w-24 text-center">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : filteredJornaleros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? t("jornaleros.noJornalerosFound") : t("jornaleros.noJornalerosRegistered")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredJornaleros.map((jornalero) => (
                  <TableRow key={jornalero.id} className={!jornalero.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{jornalero.name}</TableCell>
                    <TableCell className="font-mono">{jornalero.cedula}</TableCell>
                    <TableCell className="text-center">
                      <CedulaUploadCell
                        kind="jornalero"
                        recordId={jornalero.id}
                        table="jornaleros"
                        currentPath={jornalero.cedula_attachment_url}
                        canWrite={canWrite}
                        onUploaded={() => queryClient.invalidateQueries({ queryKey: ["jornaleros"] })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={jornalero.is_active ? "default" : "secondary"}>
                        {jornalero.is_active ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(jornalero)}
                            title={t("common.edit")}
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
                            title={jornalero.is_active ? t("common.deactivate") : t("common.activate")}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJornalero ? t("jornaleros.editJornalero") : t("jornaleros.addJornalero")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.name")} *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("common.fullName")}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.cedula")} *</label>
              <Input
                value={formData.cedula}
                onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                placeholder="000-0000000-0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" /> Cédula (foto / PDF)
              </label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setCedulaFile(e.target.files?.[0] ?? null)}
              />
              {editingJornalero?.cedula_attachment_url && !cedulaFile && (
                <button
                  type="button"
                  className="text-sm text-primary underline"
                  onClick={() => handleViewCedula(editingJornalero.cedula_attachment_url)}
                >
                  Ver cédula actual
                </button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || uploading}>
                {(saveMutation.isPending || uploading) ? t("common.saving") : editingJornalero ? t("common.update") : t("common.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}