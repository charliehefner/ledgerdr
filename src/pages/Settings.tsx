import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { HelpPanelButton } from "@/components/layout/HelpPanelButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Save,
  TestTube,
  Lock,
  MapPin,
  Settings2,
  Users,
  QrCode,
  Store,
  Satellite,
  BookOpen,
  Truck,
  Building2,
  ClipboardCheck,
  MessageCircle,
  AlertTriangle,
  Tag
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserManagement } from "@/components/settings/UserManagement";
import { DatabaseBackup } from "@/components/settings/DatabaseBackup";
import { BackupExportView } from "@/components/settings/BackupExportView";
import { ScheduledDeletions } from "@/components/settings/ScheduledDeletions";
import { FarmsFieldsView } from "@/components/operations/FarmsFieldsView";
import { OperationTypesView } from "@/components/operations/OperationTypesView";
import { QRCodeManager } from "@/components/settings/QRCodeManager";
import { FollowUpRulesManager } from "@/components/settings/FollowUpRulesManager";
import { VendorAccountRules } from "@/components/settings/VendorAccountRules";
import { PostingRulesManager } from "@/components/settings/PostingRulesManager";
import { GPSLinkingManager } from "@/components/settings/GPSLinkingManager";
import { ChartOfAccountsView } from "@/components/accounting/ChartOfAccountsView";
import { TractorOperatorsManager } from "@/components/settings/TractorOperatorsManager";
import { TransportationManager } from "@/components/settings/TransportationManager";
import { EntitiesManager } from "@/components/settings/EntitiesManager";
import { ApprovalThresholdsManager } from "@/components/settings/ApprovalThresholdsManager";
import { MfaSettings } from "@/components/settings/MfaSettings";
import { TelegramSettings } from "@/components/settings/TelegramSettings";
import { ErrorLogView } from "@/components/settings/ErrorLogView";
import { SuppliersView } from "@/components/settings/SuppliersView";
import { DimensionsManager } from "@/components/settings/DimensionsManager";

export default function Settings() {
  const { canModifySettings, canModifyPostingRules } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");

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
    <MainLayout title={t("page.settings.title")} subtitle={t("page.settings.subtitle")} headerExtra={<HelpPanelButton chapter="02-getting-started" />}>
      <div className="space-y-6" role="main" aria-label={t("page.settings.title")}>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general">
              <Settings2 className="h-4 w-4 mr-2" />
              {t("settings.general")}
            </TabsTrigger>
            {canModifySettings && (
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                {t("settings.users")}
              </TabsTrigger>
            )}
            <TabsTrigger value="farms">
              <MapPin className="h-4 w-4 mr-2" />
              {t("operations.farmsFields")}
            </TabsTrigger>
            <TabsTrigger value="operation-types">
              <Settings2 className="h-4 w-4 mr-2" />
              {t("operations.operationTypes")}
            </TabsTrigger>
            {canModifySettings && (
              <TabsTrigger value="qr-codes">
                <QrCode className="h-4 w-4 mr-2" />
                {t("settings.qrCodes")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="followups">
                <Settings2 className="h-4 w-4 mr-2" />
                {t("settings.followUps")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="vendor-rules">
                <Store className="h-4 w-4 mr-2" />
                {t("settings.vendorRules")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="suppliers">
                <Truck className="h-4 w-4 mr-2" />
                Suplidores
              </TabsTrigger>
            )}
            {canModifyPostingRules && (
              <TabsTrigger value="posting-rules">
                <Settings2 className="h-4 w-4 mr-2" />
                Reglas Contab.
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="gps">
                <Satellite className="h-4 w-4 mr-2" />
                GPS
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="operators">
                <Users className="h-4 w-4 mr-2" />
                {t("settings.operators")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="transportation">
                <Truck className="h-4 w-4 mr-2" />
                {t("settings.transportation")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="chart-of-accounts">
                <BookOpen className="h-4 w-4 mr-2" />
                {t("accounting.chartOfAccounts")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="entities">
                <Building2 className="h-4 w-4 mr-2" />
                {t("settings.entities")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="approvals">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                {t("settings.approvals")}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="dimensions">
                <Tag className="h-4 w-4 mr-2" />
                {t("settings.dimensions") || "Dimensiones"}
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="backup">
                <Database className="h-4 w-4 mr-2" />
                Backup
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="telegram">
                <MessageCircle className="h-4 w-4 mr-2" />
                Telegram
              </TabsTrigger>
            )}
            {canModifySettings && (
              <TabsTrigger value="error-log">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Error Log
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <div className="max-w-3xl space-y-8 animate-fade-in">
              {/* Scheduled Deletions - Admin Only */}
              {canModifySettings && <ScheduledDeletions />}

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

              {/* MFA Settings */}
              <MfaSettings />

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
          </TabsContent>

          {canModifySettings && (
            <TabsContent value="users" className="mt-6">
              <div className="max-w-3xl">
                <UserManagement />
              </div>
            </TabsContent>
          )}

          <TabsContent value="farms" className="mt-6">
            <div className="max-w-4xl">
              <FarmsFieldsView />
            </div>
          </TabsContent>

          <TabsContent value="operation-types" className="mt-6">
            <div className="max-w-4xl">
              <OperationTypesView />
            </div>
          </TabsContent>

          {canModifySettings && (
            <TabsContent value="qr-codes" className="mt-6">
              <QRCodeManager />
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="followups" className="mt-6">
              <div className="max-w-4xl">
                <FollowUpRulesManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="vendor-rules" className="mt-6">
              <div className="max-w-4xl">
                <VendorAccountRules />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="suppliers" className="mt-6">
              <div className="max-w-6xl">
                <SuppliersView />
              </div>
            </TabsContent>
          )}

          {canModifyPostingRules && (
            <TabsContent value="posting-rules" className="mt-6">
              <div className="max-w-6xl">
                <PostingRulesManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="gps" className="mt-6">
              <div className="max-w-4xl">
                <GPSLinkingManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="operators" className="mt-6">
              <div className="max-w-3xl">
                <TractorOperatorsManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="transportation" className="mt-6">
              <div className="max-w-4xl">
                <TransportationManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="chart-of-accounts" className="mt-6">
              <div className="max-w-5xl">
                <ChartOfAccountsView />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="entities" className="mt-6">
              <div className="max-w-4xl">
                <EntitiesManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="approvals" className="mt-6">
              <div className="max-w-4xl">
                <ApprovalThresholdsManager />
              </div>
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="backup" className="mt-6">
              <BackupExportView />
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="telegram" className="mt-6">
              <TelegramSettings />
            </TabsContent>
          )}

          {canModifySettings && (
            <TabsContent value="error-log" className="mt-6">
              <div className="max-w-5xl">
                <ErrorLogView />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
