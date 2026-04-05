import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Loader2, Trash2, Mail, User, KeyRound, Eye, EyeOff, Globe, Building2, Filter, ShieldCheck, ShieldOff, Network } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";
import { Database } from "@/integrations/supabase/types";
import { roleDisplayNames, roleDescriptions, UserRole } from "@/lib/permissions";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: UserRole[] = ["admin", "management", "accountant", "supervisor", "viewer", "driver"];

interface EntityGroup {
  id: string;
  name: string;
  code: string;
}

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole;
  entity_id: string | null;
  entity_group_id: string | null;
  entity_name: string;
  created_at: string;
  mfa_enrolled?: boolean;
}

const isUsernameAccount = (email: string) => email.endsWith("@internal.jord.local");
const extractUsername = (email: string) => email.replace("@internal.jord.local", "");

export function UserManagement() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isGlobalAdmin, entities } = useEntity();

  // Create dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [useUsername, setUseUsername] = useState(false);
  const [newUserIdentifier, setNewUserIdentifier] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("accountant");
  const [newUserScopeType, setNewUserScopeType] = useState<"global" | "entity" | "group">("entity");
  const [newUserEntityId, setNewUserEntityId] = useState<string>("");
  const [newUserGroupId, setNewUserGroupId] = useState<string>("");

  // Edit dialog
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("accountant");
  const [editEntityId, setEditEntityId] = useState<string>("__global__");
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset password
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRole | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Entity filter
  const [filterEntityId, setFilterEntityId] = useState<string>("__all__");

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-users");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.users as UserWithRole[]) || [];
    },
  });

  // Filter + sort users
  const filteredUsers = useMemo(() => {
    let list = users;
    if (filterEntityId !== "__all__") {
      if (filterEntityId === "__global__") {
        list = list.filter((u) => u.entity_id === null);
      } else {
        list = list.filter((u) => u.entity_id === filterEntityId);
      }
    }
    // Sort: Global Admin first, then by entity_name, then email
    return [...list].sort((a, b) => {
      if (!a.entity_id && b.entity_id) return -1;
      if (a.entity_id && !b.entity_id) return 1;
      const entityCmp = (a.entity_name || "").localeCompare(b.entity_name || "");
      if (entityCmp !== 0) return entityCmp;
      return a.email.localeCompare(b.email);
    });
  }, [users, filterEntityId]);

  // Group users by entity for display
  const groupedUsers = useMemo(() => {
    const groups: Record<string, UserWithRole[]> = {};
    for (const user of filteredUsers) {
      const key = user.entity_name || "Global Admin";
      if (!groups[key]) groups[key] = [];
      groups[key].push(user);
    }
    return groups;
  }, [filteredUsers]);

  const handleCreateUser = async () => {
    if (!newUserIdentifier || !newUserPassword) {
      toast.error("Por favor complete todos los campos");
      return;
    }
    if (newUserPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newUserPassword)) {
      toast.error("La contraseña debe contener al menos una letra y un número");
      return;
    }

    const entityId = newUserEntityId === "__global__" ? null : newUserEntityId;

    setIsCreating(true);
    try {
      const body: Record<string, unknown> = {
        password: newUserPassword,
        role: newUserRole,
        entity_id: entityId,
      };
      if (useUsername) {
        body.username = newUserIdentifier;
      } else {
        body.email = newUserIdentifier;
      }

      const { data, error } = await supabase.functions.invoke("create-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Usuario ${newUserIdentifier} creado exitosamente`);
      setNewUserIdentifier("");
      setNewUserPassword("");
      setNewUserRole("accountant");
      setNewUserEntityId("__global__");
      setUseUsername(false);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Error al crear usuario");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEdit = (user: UserWithRole) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditEntityId(user.entity_id || "__global__");
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    const entityId = editEntityId === "__global__" ? null : editEntityId;

    setIsUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("update-user-role", {
        body: { userId: editUser.id, role: editRole, entity_id: entityId },
      });
      if (error) throw error;

      toast.success("Usuario actualizado exitosamente");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar usuario");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setDeletingUserId(deleteTarget.id);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: deleteTarget.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const displayName = isUsernameAccount(deleteTarget.email)
        ? extractUsername(deleteTarget.email)
        : deleteTarget.email;
      toast.success(`Eliminación de ${displayName} programada (24 horas)`, {
        description: "Puede cancelar desde 'Eliminaciones Pendientes' si fue un error.",
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-deletions"] });
    } catch (error: any) {
      toast.error(error.message || "Error al programar eliminación");
    } finally {
      setDeletingUserId(null);
      setDeleteTarget(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !resetPassword) return;
    if (resetPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(resetPassword)) {
      toast.error("La contraseña debe contener al menos una letra y un número");
      return;
    }

    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId: resetPasswordUser.id, newPassword: resetPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Contraseña actualizada exitosamente");
      setResetPasswordUser(null);
      setResetPassword("");
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar contraseña");
    } finally {
      setIsResetting(false);
    }
  };

  const displayName = (email: string) =>
    isUsernameAccount(email) ? extractUsername(email) : email;

  const displayIcon = (email: string) =>
    isUsernameAccount(email) ? (
      <User className="h-4 w-4 text-muted-foreground" />
    ) : (
      <Mail className="h-4 w-4 text-muted-foreground" />
    );

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">User Management</h3>
            <p className="text-sm text-muted-foreground">Manage system users and their roles</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Entity filter — global admin only */}
          {isGlobalAdmin && (
            <Select value={filterEntityId} onValueChange={setFilterEntityId}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las Entidades</SelectItem>
                <SelectItem value="__global__">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3 w-3" /> Global Admin
                  </span>
                </SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3 w-3" /> {e.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Create user button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Agregar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Agregue un nuevo usuario al sistema con sus credenciales de acceso.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Email / Username toggle */}
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant={!useUsername ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setUseUsername(false); setNewUserIdentifier(""); }}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Con Correo
                  </Button>
                  <Button
                    type="button"
                    variant={useUsername ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setUseUsername(true); setNewUserIdentifier(""); }}
                  >
                    <User className="mr-2 h-4 w-4" /> Sin Correo
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>{useUsername ? "Nombre de Usuario" : "Correo Electrónico"}</Label>
                  <Input
                    type={useUsername ? "text" : "email"}
                    placeholder={useUsername ? "ej: juan.perez" : "usuario@ejemplo.com"}
                    value={newUserIdentifier}
                    onChange={(e) => setNewUserIdentifier(e.target.value)}
                  />
                  {useUsername && (
                    <p className="text-xs text-muted-foreground">
                      El usuario iniciará sesión con este nombre de usuario y su contraseña.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 8 caracteres (letras y números)"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex flex-col">
                            <span>{roleDisplayNames[role]}</span>
                            <span className="text-xs text-muted-foreground">{roleDescriptions[role]}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Entity assignment */}
                <div className="space-y-2">
                  <Label>Asignación de Entidad</Label>
                  <Select value={newUserEntityId} onValueChange={setNewUserEntityId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isGlobalAdmin && (
                        <SelectItem value="__global__">
                          <span className="flex items-center gap-2">
                            <Globe className="h-3 w-3" /> Global Admin — Todas las Entidades
                          </span>
                        </SelectItem>
                      )}
                      {entities.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="flex items-center gap-2">
                            <Building2 className="h-3 w-3" /> {e.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateUser} disabled={isCreating}>
                  {isCreating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.creating")}</>
                  ) : (
                    t("common.createUser")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* User table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron usuarios.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedUsers).map(([groupName, groupUsers]) => (
            <div key={groupName}>
              <div className="flex items-center gap-2 mb-2">
                {groupName === "Global Admin" ? (
                  <Globe className="h-4 w-4 text-primary" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
                <h4 className="text-sm font-medium text-muted-foreground">{groupName}</h4>
                <Badge variant="secondary" className="text-xs">{groupUsers.length}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario/Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>MFA</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupUsers.map((user) => (
                    <TableRow
                      key={`${user.id}-${user.entity_id}`}
                      className="cursor-pointer"
                      onClick={() => handleOpenEdit(user)}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {displayIcon(user.email)}
                          {displayName(user.email)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{roleDisplayNames[user.role as UserRole] || user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.mfa_enrolled ? (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" /> Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ShieldOff className="h-3.5 w-3.5" /> —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.entity_id ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3" /> {user.entity_name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-primary font-medium">
                            <Globe className="h-3 w-3" /> Global Admin
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => { setResetPasswordUser(user); setResetPassword(""); }}
                            title="Restablecer contraseña"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(user)}
                            disabled={deletingUserId === user.id}
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modificar rol y asignación de entidad para{" "}
              <strong>{editUser ? displayName(editUser.email) : ""}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex flex-col">
                        <span>{roleDisplayNames[role]}</span>
                        <span className="text-xs text-muted-foreground">{roleDescriptions[role]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asignación de Entidad</Label>
              <Select value={editEntityId} onValueChange={setEditEntityId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isGlobalAdmin && (
                    <SelectItem value="__global__">
                      <span className="flex items-center gap-2">
                        <Globe className="h-3 w-3" /> Global Admin — Todas las Entidades
                      </span>
                    </SelectItem>
                  )}
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" /> {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={isUpdating}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdating}>
              {isUpdating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Actualizando...</>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              La eliminación de <strong>{deleteTarget ? displayName(deleteTarget.email) : ""}</strong> se
              programará con un retraso de <strong>24 horas</strong>. Puede cancelar desde "Eliminaciones Pendientes" si fue un error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Programar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setResetPassword(""); setShowResetPassword(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Asignar nueva contraseña para{" "}
              <strong>{resetPasswordUser ? displayName(resetPasswordUser.email) : ""}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres (letras y números)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  tabIndex={-1}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordUser(null); setResetPassword(""); }} disabled={isResetting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleResetPassword} disabled={isResetting}>
              {isResetting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.updating")}</>
              ) : (
                t("common.updatePassword")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
