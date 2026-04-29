import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  User,
  Briefcase,
  CreditCard,
  Shirt,
  Calendar,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Upload,
  Download,
  Replace,
  History,
  TrendingUp,
  Percent,
  Info,
} from "lucide-react";
import { format, differenceInDays, differenceInMonths, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { PrestacionesCalculatorDialog } from "./PrestacionesCalculatorDialog";
import { EmployeeLetterDialog } from "./EmployeeLetterDialog";

interface SalarySegment {
  startDate: string;
  endDate: string;
  salary: number;
  days: number;
  months: number;
}

interface EmployeeDetailDialogProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDetailDialog({
  employeeId,
  open,
  onOpenChange,
}: EmployeeDetailDialogProps) {
  const queryClient = useQueryClient();
  const { canModifySettings, canWriteSection, user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("info");
  const [prestacionesOpen, setPrestacionesOpen] = useState(false);
  const [letterDialogOpen, setLetterDialogOpen] = useState(false);

  // Vacation form state
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationNotes, setVacationNotes] = useState("");

  // Incident form state
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<string>("");
  const [incidentResolution, setIncidentResolution] = useState("");

  const { data: employee, isLoading: isEmployeeLoading } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      // Use employees_safe view to mask sensitive PII for non-admin users
      const { data, error } = await supabase
        .from("employees_safe")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: vacations } = useQuery({
    queryKey: ["employee-vacations", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("*")
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: incidents } = useQuery({
    queryKey: ["employee-incidents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_incidents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("incident_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: documents } = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: salaryHistory } = useQuery({
    queryKey: ["employee-salary-history", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_salary_history")
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: timesheets } = useQuery({
    queryKey: ["employee-timesheets", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_timesheets")
        .select("*, payroll_periods(*)")
        .eq("employee_id", employeeId)
        .order("work_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: payrollPeriods } = useQuery({
    queryKey: ["payroll-periods-for-employee", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .order("start_date", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  // Calculate attendance statistics
  const attendanceStats = useMemo(() => {
    if (!timesheets || timesheets.length === 0) {
      return { totalDays: 0, absentDays: 0, absentRate: 0, totalHours: 0, avgHoursPerDay: 0 };
    }

    const totalDays = timesheets.length;
    const absentDays = timesheets.filter((t) => t.is_absent).length;
    const totalHours = timesheets.reduce((sum, t) => sum + (Number(t.hours_worked) || 0), 0);
    const workedDays = totalDays - absentDays;

    return {
      totalDays,
      absentDays,
      absentRate: totalDays > 0 ? ((absentDays / totalDays) * 100) : 0,
      totalHours,
      avgHoursPerDay: workedDays > 0 ? totalHours / workedDays : 0,
    };
  }, [timesheets]);

  const isHrWriter = canWriteSection("hr");

  const laborSummary = useMemo(() => {
    if (!employee) return null;

    const hireDate = parseDateLocal(employee.date_of_hire);
    const endDate = employee.date_of_termination ? parseDateLocal(employee.date_of_termination) : new Date();
    const totalMonths = Math.max(0, differenceInMonths(endDate, hireDate));
    const years = differenceInYears(endDate, hireDate);
    const remainingMonths = Math.max(0, totalMonths - years * 12);
    const lastAnniversary = new Date(hireDate);
    lastAnniversary.setFullYear(lastAnniversary.getFullYear() + years);
    lastAnniversary.setMonth(lastAnniversary.getMonth() + remainingMonths);
    const days = Math.max(0, differenceInDays(endDate, lastAnniversary));

    const historyAsc = [...(salaryHistory || [])]
      .sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    const seededHistory = historyAsc.length === 0
      ? [{ effective_date: employee.date_of_hire, salary: Number(employee.salary), notes: null, id: "current" }]
      : historyAsc[0].effective_date === employee.date_of_hire
        ? historyAsc
        : [{ effective_date: employee.date_of_hire, salary: Number(historyAsc[0].salary), notes: "Base inicial", id: "seed" }, ...historyAsc];

    const segments: SalarySegment[] = seededHistory.map((record, index) => {
      const startDate = index === 0 ? employee.date_of_hire : record.effective_date;
      const nextRecord = seededHistory[index + 1];
      const rawEnd = nextRecord
        ? new Date(parseDateLocal(nextRecord.effective_date).getTime() - 24 * 60 * 60 * 1000)
        : endDate;
      const segmentEnd = rawEnd < parseDateLocal(startDate) ? parseDateLocal(startDate) : rawEnd;
      const daysInSegment = Math.max(1, differenceInDays(segmentEnd, parseDateLocal(startDate)) + 1);

      return {
        startDate,
        endDate: format(segmentEnd, "yyyy-MM-dd"),
        salary: Number(record.salary),
        days: daysInSegment,
        months: Number((daysInSegment / 30).toFixed(2)),
      };
    });

    const weightedTotal = segments.reduce((sum, segment) => sum + segment.salary * segment.days, 0);
    const totalDays = segments.reduce((sum, segment) => sum + segment.days, 0);
    const averageSalary = totalDays > 0 ? weightedTotal / totalDays : Number(employee.salary);

    return {
      hireDate,
      endDate: employee.date_of_termination ? parseDateLocal(employee.date_of_termination) : null,
      years,
      months: remainingMonths,
      days,
      totalMonths,
      averageSalary,
      salarySegments: segments,
    };
  }, [employee, salaryHistory]);

  // Calculate vacation summary
  const vacationSummary = useMemo(() => {
    if (!vacations || vacations.length === 0) {
      return { totalVacationDays: 0, upcomingVacations: [] };
    }

    const today = new Date();
    const totalVacationDays = vacations.reduce((sum, v) => {
      const days = differenceInDays(parseDateLocal(v.end_date), parseDateLocal(v.start_date)) + 1;
      return sum + days;
    }, 0);

    const upcomingVacations = vacations.filter(
      (v) => parseDateLocal(v.start_date) > today
    );

    return { totalVacationDays, upcomingVacations };
  }, [vacations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
    }).format(amount);
  };

  const handleAddVacation = async () => {
    if (!employeeId || !vacationStart || !vacationEnd) {
      toast.error(t("empDetail.completeDates"));
      return;
    }

    try {
      const { error } = await supabase.from("employee_vacations").insert({
        employee_id: employeeId,
        start_date: vacationStart,
        end_date: vacationEnd,
        notes: vacationNotes || null,
      });

      if (error) throw error;

      toast.success(t("empDetail.vacationAdded"));
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
      setVacationStart("");
      setVacationEnd("");
      setVacationNotes("");
    } catch (error) {
      console.error("Error adding vacation:", error);
      toast.error(t("empDetail.vacationAddError"));
    }
  };

  const handleDeleteVacation = async (vacationId: string) => {
    try {
      const { error } = await supabase
        .from("employee_vacations")
        .delete()
        .eq("id", vacationId);

      if (error) throw error;

      toast.success(t("empDetail.vacationDeleted"));
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
    } catch (error) {
      console.error("Error deleting vacation:", error);
      toast.error(t("empDetail.vacationDeleteError"));
    }
  };

  const handleAddIncident = async () => {
    if (!employeeId || !incidentDate || !incidentDesc) {
      toast.error(t("empDetail.completeDateDesc"));
      return;
    }

    try {
      const { error } = await supabase.from("employee_incidents").insert({
        employee_id: employeeId,
        incident_date: incidentDate,
        description: incidentDesc,
        severity: incidentSeverity || null,
        resolution: incidentResolution || null,
      });

      if (error) throw error;

      toast.success(t("empDetail.incidentRecorded"));
      queryClient.invalidateQueries({ queryKey: ["employee-incidents", employeeId] });
      setIncidentDate("");
      setIncidentDesc("");
      setIncidentSeverity("");
      setIncidentResolution("");
    } catch (error) {
      console.error("Error adding incident:", error);
      toast.error(t("empDetail.incidentError"));
    }
  };

  const handleDeleteIncident = async (incidentId: string) => {
    try {
      const { error } = await supabase
        .from("employee_incidents")
        .delete()
        .eq("id", incidentId);

      if (error) throw error;

      toast.success(t("empDetail.incidentDeleted"));
      queryClient.invalidateQueries({ queryKey: ["employee-incidents", employeeId] });
    } catch (error) {
      console.error("Error deleting incident:", error);
      toast.error(t("empDetail.incidentDeleteError"));
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employeeId) return;

    try {
      const fileName = `${employeeId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("employee_documents").insert({
        employee_id: employeeId,
        entity_id: (employee as any)?.entity_id,
        document_name: file.name,
        document_type: file.type,
        storage_path: fileName,
      });

      if (dbError) throw dbError;

      toast.success(t("empDetail.documentUploaded"));
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(t("empDetail.documentUploadError"));
    }

    e.target.value = "";
  };

  const handleDeleteDocument = async (docId: string, storagePath: string) => {
    try {
      await supabase.storage.from("employee-documents").remove([storagePath]);

      const { error } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      toast.success(t("empDetail.documentDeleted"));
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(t("empDetail.documentDeleteError"));
    }
  };

  const getEmployeeDocumentSignedUrl = async (storagePath: string) => {
    const { data, error } = await supabase.functions.invoke("get-signed-url", {
      body: { filePath: storagePath, bucket: "employee-documents" },
    });

    if (error || !data?.signedUrl) {
      throw error || new Error("No URL returned");
    }

    return data.signedUrl as string;
  };

  const handleViewDocument = async (storagePath: string) => {
    const previewWindow = window.open("", "_blank", "noopener,noreferrer");

    try {
      const signedUrl = await getEmployeeDocumentSignedUrl(storagePath);

      if (previewWindow) {
        previewWindow.location.href = signedUrl;
      } else {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      previewWindow?.close();
      console.error("Error getting signed URL:", error);
      toast.error("Error al abrir documento");
    }
  };

  const handleDownloadDocument = async (storagePath: string, fileName?: string | null) => {
    try {
      const signedUrl = await getEmployeeDocumentSignedUrl(storagePath);
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName || storagePath.split("/").pop() || "documento";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Error al descargar documento");
    }
  };

  const handleReplaceDocument = async (docId: string, storagePath: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Upload replacement file to same path (overwrite)
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update document record with new name/type
      const { error: dbError } = await supabase
        .from("employee_documents")
        .update({
          document_name: file.name,
          document_type: file.type,
        })
        .eq("id", docId);

      if (dbError) throw dbError;

      toast.success("Documento reemplazado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    } catch (error) {
      console.error("Error replacing document:", error);
      toast.error("Error al reemplazar documento");
    }
    e.target.value = "";
  };

  if (!employee) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Empleado
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-sm text-muted-foreground">
            {isEmployeeLoading ? "Cargando empleado..." : "No se pudo cargar el empleado."}
          </div>
        </DialogContent>
      </Dialog>
    );
  }



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {employee.name}
            <Badge variant={employee.is_active ? "default" : "secondary"}>
              {employee.is_active ? t("empDetail.active") : t("empDetail.inactive")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="info">{t("empDetail.info")}</TabsTrigger>
            <TabsTrigger value="history">{t("empDetail.history")}</TabsTrigger>
              <TabsTrigger value="prestaciones">{t("empDetail.prestaciones")}</TabsTrigger>
            <TabsTrigger value="salary">{t("empDetail.salary")}</TabsTrigger>
            <TabsTrigger value="vacations">{t("empDetail.vacations")}</TabsTrigger>
            <TabsTrigger value="incidents">{t("empDetail.incidents")}</TabsTrigger>
            <TabsTrigger value="documents">{t("empDetail.documents")}</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t("empDetail.personal")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.cedula")}</span>
                    <span className="font-mono">{employee.cedula}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.dateOfBirth")}</span>
                    <span>
                      {employee.date_of_birth
                        ? format(parseDateLocal(employee.date_of_birth), "d MMM yyyy", { locale: es })
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {t("empDetail.employment")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.hireDate")}</span>
                    <span>{format(parseDateLocal(employee.date_of_hire), "d MMM yyyy", { locale: es })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.currentSalary")}</span>
                    <span className="font-semibold">{formatCurrency(employee.salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.seniority")}</span>
                    <span>{laborSummary ? t("empDetail.seniorityFormat").replace("{years}", String(laborSummary.years)).replace("{months}", String(laborSummary.months)).replace("{days}", String(laborSummary.days)) : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.exitDate")}</span>
                    <span>
                      {employee.date_of_termination
                        ? format(parseDateLocal(employee.date_of_termination), "d MMM yyyy", { locale: es })
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t("empDetail.banking")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.bank")}</span>
                    <span>{employee.bank || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.account")}</span>
                    <span className="font-mono">{employee.bank_account_number || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shirt className="h-4 w-4" />
                    {t("empDetail.uniformSizes")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.shirt")}</span>
                    <span>{employee.shirt_size || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.pants")}</span>
                    <span>{employee.pant_size || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("empDetail.boots")}</span>
                    <span>{employee.boot_size || "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="prestaciones" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Resumen laboral
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Ingreso</p>
                      <p className="mt-1 font-semibold">{format(parseDateLocal(employee.date_of_hire), "d MMM yyyy", { locale: es })}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Salida</p>
                      <p className="mt-1 font-semibold">{employee.date_of_termination ? format(parseDateLocal(employee.date_of_termination), "d MMM yyyy", { locale: es }) : "Activa"}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Antigüedad total</p>
                      <p className="mt-1 font-semibold">{laborSummary ? `${laborSummary.years}a ${laborSummary.months}m ${laborSummary.days}d` : "—"}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Salario promedio</p>
                      <p className="mt-1 font-semibold">{formatCurrency(laborSummary?.averageSalary || 0)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(laborSummary?.salarySegments || []).map((segment, index) => (
                      <div key={`${segment.startDate}-${segment.endDate}-${index}`} className="flex flex-col gap-2 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium">
                            {format(parseDateLocal(segment.startDate), "d MMM yyyy", { locale: es })} — {format(parseDateLocal(segment.endDate), "d MMM yyyy", { locale: es })}
                          </p>
                          <p className="text-sm text-muted-foreground">{segment.days} días · {segment.months.toFixed(2)} meses al mismo salario</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(segment.salary)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Cálculo de prestaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Usa salario promedio histórico y genera desglose imprimible para desahucio o dimisión.
                  </p>
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tramos salariales</span>
                      <span className="font-medium">{laborSummary?.salarySegments.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base salarial promedio</span>
                      <span className="font-medium">{formatCurrency(laborSummary?.averageSalary || 0)}</span>
                    </div>
                  </div>
                  <Button onClick={() => setPrestacionesOpen(true)} disabled={!isHrWriter}>
                    <FileText className="h-4 w-4 mr-2" />
                    Calcular Prestaciones
                  </Button>
                  {!isHrWriter && (
                    <p className="text-xs text-muted-foreground">Necesitas permisos de escritura en RRHH para guardar casos.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Salario Actual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(employee.salary)}</p>
                  {salaryHistory && salaryHistory.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {salaryHistory.length} cambios registrados
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Total Días Vacaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{vacationSummary.totalVacationDays}</p>
                  {vacationSummary.upcomingVacations.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {vacationSummary.upcomingVacations.length} próximas
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Tasa de Ausencias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{attendanceStats.absentRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {attendanceStats.absentDays} de {attendanceStats.totalDays} días
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" />
                    Prom. Horas/Día
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{attendanceStats.avgHoursPerDay.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    {attendanceStats.totalHours.toFixed(1)} horas totales
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Salary History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Historial de Salario
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salaryHistory?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin historial de salario</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha Efectiva</TableHead>
                        <TableHead className="text-right">Salario</TableHead>
                        <TableHead className="text-right">Cambio</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryHistory?.map((record, idx) => {
                        const prevRecord = salaryHistory[idx + 1];
                        const change = prevRecord
                          ? ((record.salary - prevRecord.salary) / prevRecord.salary) * 100
                          : null;
                        return (
                          <TableRow key={record.id}>
                          <TableCell>
                            {format(parseDateLocal(record.effective_date), "d MMM yyyy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(record.salary)}
                            </TableCell>
                            <TableCell className="text-right">
                              {change !== null ? (
                                <span className={change >= 0 ? "text-green-600" : "text-red-600"}>
                                  {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.notes || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Asistencia Reciente (Últimas 20 entradas)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timesheets?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin registros de asistencia</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Salida</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timesheets?.slice(0, 20).map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell>
                            {format(parseDateLocal(ts.work_date), "d MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {ts.start_time ? format(new Date(`2000-01-01T${ts.start_time}`), "h:mm a") : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {ts.end_time ? format(new Date(`2000-01-01T${ts.end_time}`), "h:mm a") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {ts.hours_worked ? Number(ts.hours_worked).toFixed(1) : "—"}
                          </TableCell>
                          <TableCell>
                            {ts.is_absent ? (
                              <Badge variant="destructive">Ausente</Badge>
                            ) : ts.hours_worked ? (
                              <Badge variant="default">Trabajado</Badge>
                            ) : (
                              <Badge variant="secondary">Sin Entrada</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Salary History Tab */}
          <TabsContent value="salary">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Historial de Salario</CardTitle>
              </CardHeader>
              <CardContent>
                {salaryHistory?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin historial de salario</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha Efectiva</TableHead>
                        <TableHead className="text-right">Salario</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryHistory?.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(parseDateLocal(record.effective_date), "d MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(record.salary)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vacations Tab */}
          <TabsContent value="vacations" className="space-y-4">
            {!employee.is_active && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                Empleado desvinculado — no se permiten nuevos movimientos
              </div>
            )}
            {isHrWriter && employee.is_active && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Agregar Período de Vacaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Fecha de Inicio</Label>
                      <Input
                        type="date"
                        value={vacationStart}
                        onChange={(e) => setVacationStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Fecha de Fin</Label>
                      <Input
                        type="date"
                        value={vacationEnd}
                        onChange={(e) => setVacationEnd(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Input
                        placeholder="Notas opcionales"
                        value={vacationNotes}
                        onChange={(e) => setVacationNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddVacation} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Historial de Vacaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vacations?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin registros de vacaciones</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha de Inicio</TableHead>
                        <TableHead>Fecha de Fin</TableHead>
                        <TableHead className="text-right">Días</TableHead>
                        <TableHead>Notas</TableHead>
                        {isHrWriter && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacations?.map((vacation) => {
                        const days = differenceInDays(parseDateLocal(vacation.end_date), parseDateLocal(vacation.start_date)) + 1;
                        return (
                          <TableRow key={vacation.id}>
                            <TableCell>
                              {format(parseDateLocal(vacation.start_date), "d MMM yyyy", { locale: es })}
                            </TableCell>
                            <TableCell>
                              {format(parseDateLocal(vacation.end_date), "d MMM yyyy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right font-medium">{days}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {vacation.notes || "—"}
                            </TableCell>
                            {isHrWriter && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteVacation(vacation.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-4">
            {canModifySettings && employee.is_active && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Registrar Incidente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Severidad</Label>
                      <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar severidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minor">Menor</SelectItem>
                          <SelectItem value="moderate">Moderado</SelectItem>
                          <SelectItem value="major">Mayor</SelectItem>
                          <SelectItem value="critical">Crítico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Descripción</Label>
                      <Input
                        placeholder="Describa el incidente"
                        value={incidentDesc}
                        onChange={(e) => setIncidentDesc(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Resolución (Opcional)</Label>
                      <Input
                        placeholder="¿Cómo se resolvió?"
                        value={incidentResolution}
                        onChange={(e) => setIncidentResolution(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button onClick={handleAddIncident}>
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar Incidente
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Historial de Incidentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidents?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin incidentes registrados</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Severidad</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Resolución</TableHead>
                        {canModifySettings && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents?.map((incident) => (
                        <TableRow key={incident.id}>
                          <TableCell>
                            {format(parseDateLocal(incident.incident_date), "d MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                incident.severity === "critical" || incident.severity === "major"
                                  ? "destructive"
                                  : incident.severity === "moderate"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {incident.severity === "minor" ? "Menor" : 
                               incident.severity === "moderate" ? "Moderado" :
                               incident.severity === "major" ? "Mayor" :
                               incident.severity === "critical" ? "Crítico" : "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>{incident.description}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {incident.resolution || "—"}
                          </TableCell>
                          {canModifySettings && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteIncident(incident.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            {isHrWriter && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Subir Documento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      onChange={handleDocumentUpload}
                      className="max-w-sm"
                    />
                    <Button size="sm" variant="outline" onClick={() => setLetterDialogOpen(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Carta
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Subir permisos médicos, contratos, etc.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin documentos subidos</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Subido</TableHead>
                        <TableHead className="w-32">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents?.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell
                            className="font-medium cursor-pointer text-primary hover:underline"
                            onClick={() => handleViewDocument(doc.storage_path)}
                          >
                            {doc.document_name || doc.storage_path.split("/").pop() || "Documento"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {doc.letter_type
                              ? doc.letter_type === "contrato" ? "Contrato"
                                : doc.letter_type === "terminacion" ? "Terminación"
                                : doc.letter_type === "carta_banco" ? "Carta Banco"
                                : doc.letter_type === "vacaciones" ? "Vacaciones"
                                : doc.document_type
                              : doc.document_type}
                          </TableCell>
                          <TableCell>
                            {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Descargar"
                                onClick={() => handleDownloadDocument(doc.storage_path, doc.document_name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {isHrWriter && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Reemplazar con documento firmado"
                                    onClick={() => {
                                      const input = document.createElement("input");
                                      input.type = "file";
                                      input.accept = ".pdf,.jpg,.jpeg,.png";
                                      input.onchange = (e) =>
                                        handleReplaceDocument(doc.id, doc.storage_path, e as any);
                                      input.click();
                                    }}
                                  >
                                    <Replace className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Eliminar"
                                    onClick={() => handleDeleteDocument(doc.id, doc.storage_path)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {employee && laborSummary && (
        <PrestacionesCalculatorDialog
          employee={{
            id: employee.id,
            name: employee.name,
            position: employee.position,
            date_of_hire: employee.date_of_hire,
            date_of_termination: employee.date_of_termination,
          }}
          open={prestacionesOpen}
          onOpenChange={setPrestacionesOpen}
          salarySegments={laborSummary.salarySegments}
          canSave={isHrWriter}
          userId={user?.id}
        />
      )}

      {employee && (
        <EmployeeLetterDialog
          employee={{
            id: employee.id,
            name: employee.name,
            cedula: employee.cedula,
            position: employee.position,
            salary: employee.salary,
            date_of_hire: employee.date_of_hire,
          }}
          open={letterDialogOpen}
          onOpenChange={setLetterDialogOpen}
        />
      )}
    </Dialog>
  );
}
