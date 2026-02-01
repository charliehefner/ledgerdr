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
import { useLanguage } from "@/contexts/LanguageContext";
import { UserManagement } from "@/components/settings/UserManagement";
import { DatabaseBackup } from "@/components/settings/DatabaseBackup";
import { ScheduledDeletions } from "@/components/settings/ScheduledDeletions";

export default function Settings() {
  const { canModifySettings } = useAuth();
  const { t } = useLanguage();

  const handleTestConnection = () => {
    if (!canModifySettings) {
      toast.error(t("msg.noPermission"));
      return;
    }
    toast.info(t("msg.testingConnection"));
    setTimeout(() => {
      toast.success(t("msg.connectionSuccess"));
    }, 1500);
  };

  const handleSave = () => {
    if (!canModifySettings) {
      toast.error(t("msg.noPermission"));
      return;
    }
    toast.success(t("msg.settingsSaved"));
  };

  return (
    <MainLayout title={t("page.settings.title")} subtitle={t("page.settings.subtitle")}>
      <div className="max-w-3xl space-y-8 animate-fade-in">
        {/* Access Restriction Banner */}
        {!canModifySettings && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{t("settings.readOnlyAccess")}</p>
              <p className="text-sm text-muted-foreground">
                {t("settings.readOnlyMessage")}
              </p>
            </div>
          </div>
        )}

        {/* Scheduled Deletions - Admin Only */}
        {canModifySettings && <ScheduledDeletions />}

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
              <h3 className="font-semibold">{t("settings.database")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.databaseSubtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="host">{t("form.host")}</Label>
                <Input id="host" placeholder="db.example.com" disabled={!canModifySettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">{t("form.port")}</Label>
                <Input id="port" placeholder="5432" disabled={!canModifySettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">{t("form.databaseName")}</Label>
                <Input id="database" placeholder="expense_ledger" disabled={!canModifySettings} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">{t("form.username")}</Label>
                <Input id="user" placeholder="db_user" disabled={!canModifySettings} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="password">{t("form.password")}</Label>
                <Input id="password" type="password" placeholder="••••••••" disabled={!canModifySettings} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={!canModifySettings}>
                <TestTube className="mr-2 h-4 w-4" />
                {t("settings.testConnection")}
              </Button>
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
              <h3 className="font-semibold">{t("settings.preferences")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.preferencesSubtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">{t("settings.defaultCurrency")}</Label>
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
                <Label htmlFor="dateFormat">{t("settings.dateFormat")}</Label>
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
              <Label htmlFor="taxRate">{t("settings.taxRate")}</Label>
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
              <h3 className="font-semibold">{t("settings.notifications")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.notificationsSubtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("settings.dueAlerts")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.dueAlertsDesc")}
                </p>
              </div>
              <Switch defaultChecked disabled={!canModifySettings} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("settings.paymentReminders")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.paymentRemindersDesc")}
                </p>
              </div>
              <Switch defaultChecked disabled={!canModifySettings} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("settings.weeklySummary")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.weeklySummaryDesc")}
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
              <p className="font-medium">{t("settings.securityNote")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.securityNoteText")}
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {canModifySettings && (
          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              {t("settings.saveSettings")}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
