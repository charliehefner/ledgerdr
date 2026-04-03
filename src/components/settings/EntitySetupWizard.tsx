import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  BookOpen,
  CalendarDays,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Loader2,
  UserPlus,
  Mail,
  User,
  Trash2,
  Rocket,
  Eye,
  EyeOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Database } from "@/integrations/supabase/types";
import { roleDisplayNames, roleDescriptions, UserRole } from "@/lib/permissions";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: UserRole[] = ["admin", "management", "accountant", "supervisor", "viewer", "driver"];

interface EntitySetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
  entityCode: string;
  onComplete?: () => void;
}

interface EntityForm {
  name: string;
  code: string;
  country_code: string;
  currency: string;
  rnc: string;
  tss_nomina_code: string;
}

interface InvitedUser {
  identifier: string;
  role: AppRole;
  isUsername: boolean;
  password: string;
}

const STEPS = [
  { key: "details", label: "Detalles", icon: Building2 },
  { key: "chart", label: "Plan de Cuentas", icon: BookOpen },
  { key: "accounting", label: "Período Contable", icon: CalendarDays },
  { key: "payroll", label: "Período Nómina", icon: CalendarDays },
  { key: "users", label: "Usuarios", icon: Users },
] as const;

export function EntitySetupWizard({
  open,
  onOpenChange,
  entityId,
  entityName,
  entityCode,
  onComplete,
}: EntitySetupWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Step 1 - Entity Details
  const [entityForm, setEntityForm] = useState<EntityForm>({
    name: entityName,
    code: entityCode,
    country_code: "DO",
    currency: "DOP",
    rnc: "",
    tss_nomina_code: "001",
  });
  const [savingDetails, setSavingDetails] = useState(false);

  // Step 3 - Accounting Period
  const now = new Date();
  const [acctPeriodName, setAcctPeriodName] = useState(
    format(now, "MMMM yyyy").replace(/^\w/, (c) => c.toUpperCase())
  );
  const [acctStartDate, setAcctStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [acctEndDate, setAcctEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [savingAcct, setSavingAcct] = useState(false);
  const [acctSaved, setAcctSaved] = useState(false);

  // Step 4 - Payroll Period
  const dayOfMonth = now.getDate();
  const payrollStart = dayOfMonth <= 15
    ? format(startOfMonth(now), "yyyy-MM-dd")
    : format(new Date(now.getFullYear(), now.getMonth(), 16), "yyyy-MM-dd");
  const payrollEnd = dayOfMonth <= 15
    ? format(new Date(now.getFullYear(), now.getMonth(), 15), "yyyy-MM-dd")
    : format(endOfMonth(now), "yyyy-MM-dd");
  const [prStartDate, setPrStartDate] = useState(payrollStart);
  const [prEndDate, setPrEndDate] = useState(payrollEnd);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [payrollSaved, setPayrollSaved] = useState(false);

  // Step 5 - Invite Users
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("accountant");
  const [useUsername, setUseUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Load entity details on open
  useEffect(() => {
    if (!open || !entityId) return;
    setCurrentStep(0);
    setCompleted(false);
    setAcctSaved(false);
    setPayrollSaved(false);
    setInvitedUsers([]);

    const loadEntity = async () => {
      const { data } = await supabase
        .from("entities")
        .select("name, code, country_code, currency, rnc, tss_nomina_code")
        .eq("id", entityId)
        .single();
      if (data) {
        setEntityForm({
          name: data.name,
          code: data.code,
          country_code: data.country_code || "DO",
          currency: data.currency || "DOP",
          rnc: data.rnc || "",
          tss_nomina_code: data.tss_nomina_code || "001",
        });
      }
    };
    loadEntity();
  }, [open, entityId]);

  const progressPercent = completed ? 100 : ((currentStep + 1) / (STEPS.length + 1)) * 100;

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setCompleted(true);
    }
  };

  const goBack = () => {
    if (completed) {
      setCompleted(false);
      setCurrentStep(STEPS.length - 1);
    } else if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  // Step 1: Save entity details
  const handleSaveDetails = async () => {
    if (!entityForm.name.trim()) {
      toast.error("Nombre es requerido");
      return;
    }
    setSavingDetails(true);
    try {
      const { error } = await supabase
        .from("entities")
        .update({
          name: entityForm.name.trim(),
          rnc: entityForm.rnc.trim() || null,
          tss_nomina_code: entityForm.tss_nomina_code.trim() || "001",
        })
        .eq("id", entityId);
      if (error) throw error;
      toast.success("Detalles actualizados");
      goNext();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSavingDetails(false);
    }
  };

  // Step 3: Create accounting period
  const handleSaveAcctPeriod = async () => {
    if (!acctPeriodName.trim() || !acctStartDate || !acctEndDate) {
      toast.error("Complete todos los campos");
      return;
    }
    setSavingAcct(true);
    try {
      const { error } = await supabase.from("accounting_periods").insert({
        period_name: acctPeriodName.trim(),
        start_date: acctStartDate,
        end_date: acctEndDate,
        status: "open",
      });
      if (error) throw error;
      toast.success("Período contable creado");
      setAcctSaved(true);
      goNext();
    } catch (err: any) {
      toast.error(err.message || "Error al crear período");
    } finally {
      setSavingAcct(false);
    }
  };

  // Step 4: Create payroll period
  const handleSavePayrollPeriod = async () => {
    if (!prStartDate || !prEndDate) {
      toast.error("Complete las fechas");
      return;
    }
    setSavingPayroll(true);
    try {
      const { error } = await supabase.from("payroll_periods").insert({
        start_date: prStartDate,
        end_date: prEndDate,
        entity_id: entityId,
        status: "open",
        is_current: true,
      });
      if (error) throw error;
      toast.success("Período de nómina creado");
      setPayrollSaved(true);
      goNext();
    } catch (err: any) {
      toast.error(err.message || "Error al crear período");
    } finally {
      setSavingPayroll(false);
    }
  };

  // Step 5: Invite a user
  const handleInviteUser = async () => {
    if (!newIdentifier || !newPassword) {
      toast.error("Complete todos los campos");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      toast.error("La contraseña debe contener al menos una letra y un número");
      return;
    }

    setInviting(true);
    try {
      const body: Record<string, unknown> = {
        password: newPassword,
        role: newRole,
        entity_id: entityId,
      };
      if (useUsername) {
        body.username = newIdentifier;
      } else {
        body.email = newIdentifier;
      }

      const { data, error } = await supabase.functions.invoke("create-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInvitedUsers((prev) => [
        ...prev,
        { identifier: newIdentifier, role: newRole, isUsername: useUsername, password: "" },
      ]);
      toast.success(`Usuario ${newIdentifier} creado`);
      setNewIdentifier("");
      setNewPassword("");
      setNewRole("accountant");
    } catch (err: any) {
      toast.error(err.message || "Error al crear usuario");
    } finally {
      setInviting(false);
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
    onComplete?.();
  };

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    onComplete?.();
    navigate(path);
  };

  // ---- Render Steps ----

  const renderStepContent = () => {
    if (completed) return renderCompletionScreen();

    switch (currentStep) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      case 3:
        return renderStep4();
      case 4:
        return renderStep5();
      default:
        return null;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confirme o edite los datos de la entidad.
      </p>
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            value={entityForm.name}
            onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Código</Label>
          <Input value={entityForm.code} disabled className="font-mono bg-muted" />
          <p className="text-xs text-muted-foreground">No se puede cambiar después de creación.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>País</Label>
            <Input value={entityForm.country_code} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Input value={entityForm.currency} disabled className="bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>RNC</Label>
          <Input
            value={entityForm.rnc}
            onChange={(e) => setEntityForm((f) => ({ ...f, rnc: e.target.value.replace(/[^0-9]/g, "") }))}
            placeholder="9 dígitos"
            maxLength={11}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">Requerido para reportes DGII (606, 607, 608)</p>
        </div>
        <div className="space-y-2">
          <Label>Código Nómina TSS</Label>
          <Input
            value={entityForm.tss_nomina_code}
            onChange={(e) => setEntityForm((f) => ({ ...f, tss_nomina_code: e.target.value.replace(/[^0-9]/g, "") }))}
            placeholder="001"
            maxLength={3}
            className="font-mono"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSaveDetails} disabled={savingDetails}>
          {savingDetails ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar y Continuar
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        El plan de cuentas es compartido entre todas las entidades. Seleccione una opción:
      </p>
      <div className="grid gap-4">
        <button
          onClick={goNext}
          className="flex items-start gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5 text-left hover:bg-primary/10 transition-colors"
        >
          <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Usar plan de cuentas dominicano estándar</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ya está precargado con ~460 cuentas estándar. Recomendado para la mayoría de empresas dominicanas.
            </p>
          </div>
        </button>
        <button
          onClick={goNext}
          className="flex items-start gap-4 p-4 rounded-lg border border-border text-left hover:bg-muted/50 transition-colors"
        >
          <SkipForward className="h-6 w-6 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Personalizaré después</p>
            <p className="text-sm text-muted-foreground mt-1">
              Puede modificar el catálogo de cuentas desde Contabilidad → Plan de Cuentas.
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cree el primer período contable para esta entidad. Puede omitir este paso.
      </p>
      {acctSaved ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Período contable creado exitosamente</span>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Nombre del Período</Label>
            <Input
              value={acctPeriodName}
              onChange={(e) => setAcctPeriodName(e.target.value)}
              placeholder="Enero 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={acctStartDate}
                onChange={(e) => setAcctStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={acctEndDate}
                onChange={(e) => setAcctEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={goNext} disabled={savingAcct}>
          <SkipForward className="h-4 w-4 mr-2" />
          Omitir
        </Button>
        {!acctSaved && (
          <Button onClick={handleSaveAcctPeriod} disabled={savingAcct}>
            {savingAcct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Crear Período
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cree el primer período de nómina (quincenal). Puede omitir este paso.
      </p>
      {payrollSaved ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Período de nómina creado exitosamente</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fecha Inicio</Label>
            <Input
              type="date"
              value={prStartDate}
              onChange={(e) => setPrStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha Fin</Label>
            <Input
              type="date"
              value={prEndDate}
              onChange={(e) => setPrEndDate(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={goNext} disabled={savingPayroll}>
          <SkipForward className="h-4 w-4 mr-2" />
          Omitir
        </Button>
        {!payrollSaved && (
          <Button onClick={handleSavePayrollPeriod} disabled={savingPayroll}>
            {savingPayroll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Crear Período
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Invite usuarios a esta entidad. Puede agregar múltiples usuarios o hacerlo después.
      </p>

      {/* Already invited list */}
      {invitedUsers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Usuarios invitados</Label>
          <div className="space-y-1">
            {invitedUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-muted">
                {u.isUsername ? (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="flex-1">{u.identifier}</span>
                <Badge variant="secondary" className="text-xs">
                  {roleDisplayNames[u.role as UserRole]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={!useUsername ? "default" : "outline"}
            size="sm"
            onClick={() => { setUseUsername(false); setNewIdentifier(""); }}
          >
            <Mail className="mr-1 h-3.5 w-3.5" /> Correo
          </Button>
          <Button
            type="button"
            variant={useUsername ? "default" : "outline"}
            size="sm"
            onClick={() => { setUseUsername(true); setNewIdentifier(""); }}
          >
            <User className="mr-1 h-3.5 w-3.5" /> Usuario
          </Button>
        </div>
        <div className="space-y-2">
          <Input
            type={useUsername ? "text" : "email"}
            placeholder={useUsername ? "nombre.usuario" : "usuario@ejemplo.com"}
            value={newIdentifier}
            onChange={(e) => setNewIdentifier(e.target.value)}
          />
        </div>
        <div className="space-y-2 relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña (mín. 8 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
          <SelectTrigger>
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
        <Button onClick={handleInviteUser} disabled={inviting} size="sm" className="w-full">
          {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
          Agregar Usuario
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={goNext}>
          <SkipForward className="h-4 w-4 mr-2" />
          {invitedUsers.length > 0 ? "Finalizar" : "Omitir"}
        </Button>
      </div>
    </div>
  );

  const renderCompletionScreen = () => (
    <div className="space-y-6 text-center py-4">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div>
        <h3 className="text-xl font-semibold">¡Entidad lista!</h3>
        <p className="text-sm text-muted-foreground mt-2">
          <strong>{entityForm.name}</strong> está configurada y lista para operar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        <button
          onClick={() => handleNavigate("/hr")}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <Users className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Empleados</p>
            <p className="text-xs text-muted-foreground">Agregar empleados</p>
          </div>
        </button>
        <button
          onClick={() => handleNavigate("/transactions")}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Transacciones</p>
            <p className="text-xs text-muted-foreground">Registrar gastos</p>
          </div>
        </button>
        <button
          onClick={() => handleNavigate("/hr")}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <CalendarDays className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Nómina</p>
            <p className="text-xs text-muted-foreground">Procesar pagos</p>
          </div>
        </button>
        <button
          onClick={() => handleNavigate("/analytics")}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Reportes</p>
            <p className="text-xs text-muted-foreground">Ver análisis</p>
          </div>
        </button>
      </div>

      <Button onClick={handleFinish} className="w-full">
        Cerrar Asistente
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {completed ? "Configuración Completa" : "Configurar Entidad"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar + step indicators */}
        {!completed && (
          <div className="space-y-3">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex items-center justify-between">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div
                    key={step.key}
                    className={`flex flex-col items-center gap-1 ${
                      isActive
                        ? "text-primary"
                        : isDone
                        ? "text-primary/60"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isDone
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className="text-[10px] font-medium hidden sm:block">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Back button for steps > 0 */}
        {!completed && currentStep > 0 && (
          <Button variant="ghost" size="sm" className="self-start -mt-1" onClick={goBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Atrás
          </Button>
        )}

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
