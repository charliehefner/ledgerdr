import { useState } from "react";
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
import { Users, UserPlus, Loader2, Trash2, Mail, User, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { roleDisplayNames, roleDescriptions, UserRole } from "@/lib/permissions";

type AppRole = Database["public"]["Enums"]["app_role"];

// All available roles for the select dropdowns
const ALL_ROLES: UserRole[] = ["admin", "management", "accountant", "supervisor", "viewer", "driver"];

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

// Check if email is a username-based account
const isUsernameAccount = (email: string) => email.endsWith("@internal.jord.local");
const extractUsername = (email: string) => email.replace("@internal.jord.local", "");

export function UserManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [useUsername, setUseUsername] = useState(false);
  const [newUserIdentifier, setNewUserIdentifier] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("accountant");

  // Reset password state
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRole | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Fetch users with their roles via edge function (uses service role to get all users)
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-users");

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.users as UserWithRole[]) || [];
    },
  });

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

    setIsCreating(true);

    try {
      const body = useUsername 
        ? { username: newUserIdentifier, password: newUserPassword, role: newUserRole }
        : { email: newUserIdentifier, password: newUserPassword, role: newUserRole };

      const { data, error } = await supabase.functions.invoke("create-user", {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const displayName = useUsername ? newUserIdentifier : newUserIdentifier;
      toast.success(`Usuario ${displayName} creado exitosamente`);
      setNewUserIdentifier("");
      setNewUserPassword("");
      setNewUserRole("accountant");
      setUseUsername(false);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Error al crear usuario");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const displayName = isUsernameAccount(email) ? extractUsername(email) : email;
    if (!confirm(`¿Está seguro que desea programar la eliminación de ${displayName}? El usuario será eliminado a medianoche.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Eliminación de ${displayName} programada para medianoche`, {
        description: "Puede cancelar desde 'Eliminaciones Pendientes' si fue un error.",
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-deletions"] });
    } catch (error: any) {
      toast.error(error.message || "Error al programar eliminación");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: AppRole) => {
    // ... keep existing code
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

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">User Management</h3>
            <p className="text-sm text-muted-foreground">
              Manage system users and their roles
            </p>
          </div>
        </div>

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
              {/* Toggle between email and username */}
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant={!useUsername ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseUsername(false);
                    setNewUserIdentifier("");
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Con Correo
                </Button>
                <Button
                  type="button"
                  variant={useUsername ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseUsername(true);
                    setNewUserIdentifier("");
                  }}
                >
                  <User className="mr-2 h-4 w-4" />
                  Sin Correo
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-identifier">
                  {useUsername ? "Nombre de Usuario" : "Correo Electrónico"}
                </Label>
                <Input
                  id="new-identifier"
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
                <Label htmlFor="new-password">Contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 8 caracteres (letras y números)"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Rol</Label>
                <Select
                  value={newUserRole}
                  onValueChange={(v) => setNewUserRole(v as AppRole)}
                >
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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron usuarios. Haga clic en "Agregar Usuario" para crear uno.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario/Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {isUsernameAccount(user.email) ? (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {extractUsername(user.email)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {user.email}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(v) =>
                      handleUpdateRole(user.id, v as AppRole)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleDisplayNames[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() => {
                        setResetPasswordUser(user);
                        setResetPassword("");
                      }}
                      title="Restablecer contraseña"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setResetPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Asignar nueva contraseña para{" "}
              <strong>
                {resetPasswordUser && isUsernameAccount(resetPasswordUser.email)
                  ? extractUsername(resetPasswordUser.email)
                  : resetPasswordUser?.email}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Nueva Contraseña</Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="Mínimo 8 caracteres (letras y números)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setResetPasswordUser(null); setResetPassword(""); }}
              disabled={isResetting}
            >
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isResetting}>
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar Contraseña"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
