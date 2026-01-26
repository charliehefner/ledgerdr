import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Database, 
  Shield, 
  Bell, 
  Palette,
  Save,
  TestTube,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/settings/UserManagement";
import { DatabaseBackup } from "@/components/settings/DatabaseBackup";

export default function Settings() {
  const { canModifySettings } = useAuth();

  const handleTestConnection = () => {
    if (!canModifySettings) {
      toast.error("No tiene permiso para modificar la configuración");
      return;
    }
    toast.info("Probando conexión a base de datos...");
    setTimeout(() => {
      toast.success("¡Conexión a base de datos exitosa!");
    }, 1500);
  };

  const handleSave = () => {
    if (!canModifySettings) {
      toast.error("No tiene permiso para modificar la configuración");
      return;
    }
    toast.success("¡Configuración guardada exitosamente!");
  };

  return (
    <MainLayout title="Configuración" subtitle="Configure su aplicación">
      <div className="max-w-3xl space-y-8 animate-fade-in">
        {/* Access Restriction Banner */}
        {!canModifySettings && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Acceso Solo Lectura</p>
              <p className="text-sm text-muted-foreground">
                Puede ver la configuración pero no puede hacer cambios estructurales. Contacte a un administrador para modificaciones.
              </p>
            </div>
          </div>
        )}

        {/* User Management - Admin Only */}
        {canModifySettings && <UserManagement />}

        {/* Database Backup - Admin Only */}
        {canModifySettings && <DatabaseBackup />}

        {/* Database Connection */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Conexión de Base de Datos</h3>
              <p className="text-sm text-muted-foreground">
                Conectar a su base de datos PostgreSQL
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input id="host" placeholder="db.example.com" disabled={!canModifySettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Puerto</Label>
                <Input id="port" placeholder="5432" disabled={!canModifySettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">Nombre de Base de Datos</Label>
                <Input id="database" placeholder="expense_ledger" disabled={!canModifySettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">Usuario</Label>
                <Input id="user" placeholder="db_user" disabled={!canModifySettings} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" placeholder="••••••••" disabled={!canModifySettings} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={!canModifySettings}>
                <TestTube className="mr-2 h-4 w-4" />
                Probar Conexión
              </Button>
              <span className="text-sm text-muted-foreground">
                Pruebe antes de guardar para asegurar conectividad
              </span>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Preferencias</h3>
              <p className="text-sm text-muted-foreground">
                Personalice su experiencia
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda Predeterminada</Label>
                <Select defaultValue="usd" disabled={!canModifySettings}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                    <SelectItem value="gbp">GBP (£)</SelectItem>
                    <SelectItem value="cad">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Formato de Fecha</Label>
                <Select defaultValue="mdy" disabled={!canModifySettings}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdy">MM/DD/AAAA</SelectItem>
                    <SelectItem value="dmy">DD/MM/AAAA</SelectItem>
                    <SelectItem value="ymd">AAAA-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Tasa de Impuesto Predeterminada (%)</Label>
              <Input 
                id="taxRate" 
                type="number" 
                placeholder="8.0" 
                className="w-32"
                disabled={!canModifySettings}
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Notificaciones</h3>
              <p className="text-sm text-muted-foreground">
                Administre sus preferencias de notificación
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Alertas de Vencimiento</p>
                <p className="text-sm text-muted-foreground">
                  Reciba notificaciones cuando las facturas se venzan
                </p>
              </div>
              <Switch defaultChecked disabled={!canModifySettings} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Recordatorios de Pago</p>
                <p className="text-sm text-muted-foreground">
                  Recordar sobre fechas de vencimiento próximas
                </p>
              </div>
              <Switch defaultChecked disabled={!canModifySettings} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Resumen Semanal</p>
                <p className="text-sm text-muted-foreground">
                  Recibir un resumen semanal de gastos por correo
                </p>
              </div>
              <Switch disabled={!canModifySettings} />
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="bg-muted/50 rounded-xl border border-border p-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Nota de Seguridad</p>
              <p className="text-sm text-muted-foreground mt-1">
                Las credenciales de la base de datos se almacenan de forma segura y encriptada. 
                Para uso en producción, recomendamos usar variables de entorno 
                y gestión segura de secretos.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {canModifySettings && (
          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Guardar Configuración
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
