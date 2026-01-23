import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  History,
  TrendingUp,
  Percent,
} from "lucide-react";
import { format, differenceInDays, differenceInMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
  const { canModifySettings } = useAuth();
  const [activeTab, setActiveTab] = useState("info");

  // Vacation form state
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationNotes, setVacationNotes] = useState("");

  // Incident form state
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<string>("");
  const [incidentResolution, setIncidentResolution] = useState("");

  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId)
        .single();
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

  // Calculate vacation summary
  const vacationSummary = useMemo(() => {
    if (!vacations || vacations.length === 0) {
      return { totalVacationDays: 0, upcomingVacations: [] };
    }

    const today = new Date();
    const totalVacationDays = vacations.reduce((sum, v) => {
      const days = differenceInDays(new Date(v.end_date), new Date(v.start_date)) + 1;
      return sum + days;
    }, 0);

    const upcomingVacations = vacations.filter(
      (v) => new Date(v.start_date) > today
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
      toast.error("Please fill in start and end dates");
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

      toast.success("Vacation period added");
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
      setVacationStart("");
      setVacationEnd("");
      setVacationNotes("");
    } catch (error) {
      console.error("Error adding vacation:", error);
      toast.error("Failed to add vacation");
    }
  };

  const handleDeleteVacation = async (vacationId: string) => {
    try {
      const { error } = await supabase
        .from("employee_vacations")
        .delete()
        .eq("id", vacationId);

      if (error) throw error;

      toast.success("Vacation deleted");
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
    } catch (error) {
      console.error("Error deleting vacation:", error);
      toast.error("Failed to delete vacation");
    }
  };

  const handleAddIncident = async () => {
    if (!employeeId || !incidentDate || !incidentDesc) {
      toast.error("Please fill in date and description");
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

      toast.success("Incident recorded");
      queryClient.invalidateQueries({ queryKey: ["employee-incidents", employeeId] });
      setIncidentDate("");
      setIncidentDesc("");
      setIncidentSeverity("");
      setIncidentResolution("");
    } catch (error) {
      console.error("Error adding incident:", error);
      toast.error("Failed to add incident");
    }
  };

  const handleDeleteIncident = async (incidentId: string) => {
    try {
      const { error } = await supabase
        .from("employee_incidents")
        .delete()
        .eq("id", incidentId);

      if (error) throw error;

      toast.success("Incident deleted");
      queryClient.invalidateQueries({ queryKey: ["employee-incidents", employeeId] });
    } catch (error) {
      console.error("Error deleting incident:", error);
      toast.error("Failed to delete incident");
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
        document_name: file.name,
        document_type: file.type,
        storage_path: fileName,
      });

      if (dbError) throw dbError;

      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
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

      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {employee.name}
            <Badge variant={employee.is_active ? "default" : "secondary"}>
              {employee.is_active ? "Active" : "Inactive"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="salary">Salary</TabsTrigger>
            <TabsTrigger value="vacations">Vacations</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cédula</span>
                    <span className="font-mono">{employee.cedula}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span>
                      {employee.date_of_birth
                        ? format(new Date(employee.date_of_birth), "MMM d, yyyy")
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Employment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Hire</span>
                    <span>{format(new Date(employee.date_of_hire), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Salary</span>
                    <span className="font-semibold">{formatCurrency(employee.salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tenure</span>
                    <span>
                      {differenceInMonths(new Date(), new Date(employee.date_of_hire))} months
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Banking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{employee.bank || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-mono">{employee.bank_account_number || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shirt className="h-4 w-4" />
                    Uniform Sizes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shirt</span>
                    <span>{employee.shirt_size || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pants</span>
                    <span>{employee.pant_size || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Boots</span>
                    <span>{employee.boot_size || "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab - NEW */}
          <TabsContent value="history" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Current Salary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(employee.salary)}</p>
                  {salaryHistory && salaryHistory.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {salaryHistory.length} changes recorded
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Total Vacation Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{vacationSummary.totalVacationDays}</p>
                  {vacationSummary.upcomingVacations.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {vacationSummary.upcomingVacations.length} upcoming
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Absence Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{attendanceStats.absentRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {attendanceStats.absentDays} of {attendanceStats.totalDays} days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" />
                    Avg Hours/Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{attendanceStats.avgHoursPerDay.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    {attendanceStats.totalHours.toFixed(1)} total hours
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Salary History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Salary History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salaryHistory?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No salary history</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Effective Date</TableHead>
                        <TableHead className="text-right">Salary</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead>Notes</TableHead>
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
                              {format(new Date(record.effective_date), "MMM d, yyyy")}
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
                  Recent Attendance (Last 20 entries)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timesheets?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No timesheet records</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timesheets?.slice(0, 20).map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell>
                            {format(new Date(ts.work_date), "MMM d, yyyy")}
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
                              <Badge variant="destructive">Absent</Badge>
                            ) : ts.hours_worked ? (
                              <Badge variant="default">Worked</Badge>
                            ) : (
                              <Badge variant="secondary">No Entry</Badge>
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
                <CardTitle className="text-sm">Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                {salaryHistory?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No salary history</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Effective Date</TableHead>
                        <TableHead className="text-right">Salary</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryHistory?.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.effective_date), "MMM d, yyyy")}
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
            {canModifySettings && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Vacation Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={vacationStart}
                        onChange={(e) => setVacationStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={vacationEnd}
                        onChange={(e) => setVacationEnd(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        placeholder="Optional notes"
                        value={vacationNotes}
                        onChange={(e) => setVacationNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddVacation} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add
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
                  Vacation History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vacations?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No vacation records</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Notes</TableHead>
                        {canModifySettings && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacations?.map((vacation) => {
                        const days = differenceInDays(new Date(vacation.end_date), new Date(vacation.start_date)) + 1;
                        return (
                          <TableRow key={vacation.id}>
                            <TableCell>
                              {format(new Date(vacation.start_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              {format(new Date(vacation.end_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right font-medium">{days}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {vacation.notes || "—"}
                            </TableCell>
                            {canModifySettings && (
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
            {canModifySettings && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Record Incident
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Severity</Label>
                      <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minor">Minor</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="major">Major</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        placeholder="Describe the incident"
                        value={incidentDesc}
                        onChange={(e) => setIncidentDesc(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Resolution (Optional)</Label>
                      <Input
                        placeholder="How was this resolved?"
                        value={incidentResolution}
                        onChange={(e) => setIncidentResolution(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button onClick={handleAddIncident}>
                        <Plus className="h-4 w-4 mr-2" />
                        Record Incident
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
                  Incident History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidents?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No incidents recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Resolution</TableHead>
                        {canModifySettings && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents?.map((incident) => (
                        <TableRow key={incident.id}>
                          <TableCell>
                            {format(new Date(incident.incident_date), "MMM d, yyyy")}
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
                              {incident.severity || "—"}
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
            {canModifySettings && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      onChange={handleDocumentUpload}
                      className="max-w-sm"
                    />
                    <p className="text-sm text-muted-foreground">
                      Upload medical permits, contracts, etc.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No documents uploaded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Uploaded</TableHead>
                        {canModifySettings && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents?.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.document_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {doc.document_type}
                          </TableCell>
                          <TableCell>
                            {format(new Date(doc.created_at), "MMM d, yyyy")}
                          </TableCell>
                          {canModifySettings && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id, doc.storage_path)}
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
