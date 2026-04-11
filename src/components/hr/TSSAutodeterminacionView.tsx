import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Eye, FileText, Loader2, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { toast } from "sonner";
import { useEntity } from "@/contexts/EntityContext";
import { useLanguage } from "@/contexts/LanguageContext";

// DR TSS contribution rates
const TSS_RATES = {
  empSFS: 0.0304,
  empAFP: 0.0287,
  erSFS: 0.0709,
  erAFP: 0.0710,
  erSRL: 0.0110,
};

const TSS_CEILINGS = {
  sfs: 210000,
  afp: 420000,
};

function calcTssForEmployee(salary: number) {
  const sfsSalary = Math.min(salary, TSS_CEILINGS.sfs);
  const afpSalary = Math.min(salary, TSS_CEILINGS.afp);
  const empSFS = sfsSalary * TSS_RATES.empSFS;
  const empAFP = afpSalary * TSS_RATES.empAFP;
  const erSFS = sfsSalary * TSS_RATES.erSFS;
  const erAFP = afpSalary * TSS_RATES.erAFP;
  const erSRL = salary * TSS_RATES.erSRL;
  return { empSFS, empAFP, erSFS, erAFP, erSRL };
}

const EMPLOYER_RNC = "132214048";

function padRight(str: string, len: number): string {
  return (str || "").substring(0, len).padEnd(len, " ");
}
function padLeft(str: string, len: number, fill = " "): string {
  return (str || "").substring(0, len).padStart(len, fill);
}
function formatAmount(amount: number, len = 16): string {
  return Math.max(0, amount).toFixed(2).padStart(len, "0");
}
function formatDateDDMMAAAA(dateStr: string | null): string {
  if (!dateStr) return "00000000";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}
function cleanCedula(cedula: string): string {
  return (cedula || "").replace(/[-\s]/g, "");
}
function splitName(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length <= 2) return { nombres: parts[0] || "", apellido1: parts[1] || "", apellido2: "" };
  if (parts.length === 3) return { nombres: parts[0], apellido1: parts[1], apellido2: parts[2] };
  return { nombres: parts.slice(0, 2).join(" "), apellido1: parts[2] || "", apellido2: parts.slice(3).join(" ") };
}

interface TssEmployeeRow {
  employeeId: string;
  name: string;
  cedula: string;
  dateOfBirth: string | null;
  monthlySalary: number;
  source: "snapshot" | "estimate";
}

function generateEncabezado(rnc: string, periodo: string): string {
  return "E" + "AM" + padLeft(rnc, 11) + periodo;
}
function generateDetalle(emp: TssEmployeeRow, claveNomina = "001"): string {
  const { nombres, apellido1, apellido2 } = splitName(emp.name);
  let line = "D";
  line += padLeft(claveNomina, 3, "0");
  line += "C";
  line += padRight(cleanCedula(emp.cedula), 25);
  line += padRight(nombres, 50);
  line += padRight(apellido1, 40);
  line += padRight(apellido2, 40);
  line += " ";
  line += formatDateDDMMAAAA(emp.dateOfBirth);
  line += formatAmount(emp.monthlySalary);
  line += formatAmount(0);
  line += formatAmount(0);
  line += formatAmount(0);
  line += padLeft("", 11);
  line += formatAmount(0);
  line += formatAmount(0);
  line += formatAmount(0);
  line += formatAmount(0);
  line += "0001";
  line += "01" + formatAmount(0);
  line += "02" + formatAmount(0);
  line += "03" + formatAmount(0);
  return line;
}
function generateSumario(totalRecords: number): string {
  return "S" + String(totalRecords).padStart(6, "0");
}

export function TSSAutodeterminacionView() {
  const { selectedEntityId } = useEntity();
  const { t } = useLanguage();
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showPreview, setShowPreview] = useState(false);
  const [retroactiva, setRetroactiva] = useState(false);
  const [downloadingTxt, setDownloadingTxt] = useState(false);

  const months = Array.from({ length: 12 }, (_, i) => {
    const val = String(i + 1).padStart(2, "0");
    return { value: val, label: t(`month.${val}`) };
  });

  const { data: entityInfo } = useQuery({
    queryKey: ["entity-tss-info", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const { data, error } = await supabase
        .from("entities")
        .select("rnc, tss_nomina_code")
        .eq("id", selectedEntityId)
        .maybeSingle();
      if (error) throw error;
      return data as { rnc: string | null; tss_nomina_code: string | null } | null;
    },
    enabled: !!selectedEntityId,
  });

  const entityRnc = entityInfo?.rnc || null;
  const entityNominaCode = entityInfo?.tss_nomina_code || "001";

  const periodo = `${selectedMonth}${selectedYear}`;
  const monthInt = parseInt(selectedMonth);
  const yearInt = parseInt(selectedYear);

  const monthStart = `${selectedYear}-${selectedMonth}-01`;
  const lastDay = new Date(yearInt, monthInt, 0).getDate();
  const monthEnd = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  const { data: employees = [], isLoading: loadingEmp } = useQuery({
    queryKey: ["employees-tss"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, cedula, salary, date_of_birth, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: periodSnapshots = [], isLoading: loadingSnap } = useQuery({
    queryKey: ["tss-snapshots", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data: periods, error: pErr } = await supabase
        .from("payroll_periods")
        .select("id, start_date, end_date, status")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart);
      if (pErr) throw pErr;
      if (!periods || periods.length === 0) return [];
      const closedPeriodIds = periods.filter((p) => p.status === "closed").map((p) => p.id);
      if (closedPeriodIds.length === 0) return [];
      const { data: snapshots, error: sErr } = await supabase
        .from("payroll_snapshots")
        .select("employee_id, gross_pay, tss")
        .in("period_id", closedPeriodIds);
      if (sErr) throw sErr;
      return snapshots || [];
    },
  });

  const tssRows = useMemo<TssEmployeeRow[]>(() => {
    const snapshotMap = new Map<string, number>();
    for (const snap of periodSnapshots) {
      snapshotMap.set(snap.employee_id, (snapshotMap.get(snap.employee_id) || 0) + (snap.gross_pay || 0));
    }

    return employees.map((emp) => {
      const snapshotSalary = snapshotMap.get(emp.id);
      const hasSnapshot = snapshotSalary !== undefined && snapshotSalary > 0;
      return {
        employeeId: emp.id,
        name: emp.name,
        cedula: emp.cedula,
        dateOfBirth: emp.date_of_birth,
        monthlySalary: hasSnapshot ? snapshotSalary : emp.salary,
        source: hasSnapshot ? "snapshot" as const : "estimate" as const,
      };
    });
  }, [employees, periodSnapshots]);

  const hasAnySnapshot = tssRows.some((r) => r.source === "snapshot");

  const fileContent = useMemo(() => {
    if (tssRows.length === 0) return "";
    const lines: string[] = [];
    lines.push(generateEncabezado(EMPLOYER_RNC, periodo));
    tssRows.forEach((emp) => lines.push(generateDetalle(emp)));
    lines.push(generateSumario(lines.length + 1));
    return lines.join("\n");
  }, [tssRows, periodo]);

  const handleDownload = () => {
    if (!fileContent) {
      toast.error(t("tss.noEmployeesError"));
      return;
    }
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const suffix = retroactiva ? "EAR" : "AM";
    const fileName = `TSS_${suffix}_${selectedYear}${selectedMonth}.txt`;
    triggerDownload(blob, fileName);
  };

  const handleDownloadRpc = async () => {
    if (!selectedEntityId) {
      toast.error(t("tss.selectEntity"));
      return;
    }
    setDownloadingTxt(true);
    try {
      const { data, error } = await (supabase.rpc as any)("generate_tss_autodeterminacion", {
        p_year: parseInt(selectedYear),
        p_month: parseInt(selectedMonth),
        p_entity_id: selectedEntityId,
        p_retroactiva: retroactiva,
        p_own_rnc: entityRnc || "",
        p_nomina_code: entityNominaCode,
      });
      if (error) throw error;
      if (!data) {
        toast.error(t("tss.noEmployeesError"));
        return;
      }
      const blob = new Blob([data], { type: "text/plain;charset=utf-8" });
      const suffix = retroactiva ? "EAR" : "AM";
      const fileName = `TSS_${suffix}_${selectedYear}${selectedMonth}.txt`;
      triggerDownload(blob, fileName);
      toast.success(t("tss.fileGenerated"));
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("rnc")) {
        toast.error(t("tss.rncNotConfigured"));
      } else {
        toast.error(t("tss.generateError") + ": " + msg);
      }
    } finally {
      setDownloadingTxt(false);
    }
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loadingEmp || loadingSnap;
  const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("tss.title")}
            <InfoTooltip translationKey="help.tss" />
          </CardTitle>
          <CardDescription>
            {t("tss.description")}
            {" "}
            {hasAnySnapshot ? t("tss.snapshotBased") : t("tss.estimateBased")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedEntityId && !entityRnc && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t("tss.rncWarning")}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{t("ir3.month")}</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{t("ir3.year")}</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {hasAnySnapshot ? (
              <Badge variant="default" className="h-7">{t("tss.closedPayroll")}</Badge>
            ) : (
              <Badge variant="secondary" className="h-7">{t("tss.estimateBase")}</Badge>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="retroactiva"
                checked={retroactiva}
                onCheckedChange={(checked) => setRetroactiva(checked === true)}
              />
              <Label htmlFor="retroactiva" className="text-sm font-normal">{t("tss.retroactive")}</Label>
            </div>

            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? t("tss.hidePreview") : t("tss.showPreview")}
            </Button>

            <Button onClick={handleDownload} disabled={tssRows.length === 0 || isLoading}>
              <Download className="h-4 w-4 mr-2" />
              {t("tss.downloadPreview")}
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadRpc}
              disabled={!selectedEntityId || downloadingTxt || isLoading}
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              {downloadingTxt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {t("tss.downloadTxt")}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {isLoading ? t("common.loading") : t("tss.activeEmployees").replace("{count}", String(tssRows.length))}
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>{t("ir3.cedula")}</TableHead>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead className="text-right">{t("tss.cotizableSalary")}</TableHead>
                  <TableHead className="text-right">SFS Emp</TableHead>
                  <TableHead className="text-right">AFP Emp</TableHead>
                  <TableHead className="text-right">SFS Pat</TableHead>
                  <TableHead className="text-right">AFP Pat</TableHead>
                  <TableHead className="text-right">SRL Pat</TableHead>
                  <TableHead className="text-right font-semibold">{t("common.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tssRows.map((emp, idx) => {
                  const c = calcTssForEmployee(emp.monthlySalary);
                  const total = c.empSFS + c.empAFP + c.erSFS + c.erAFP + c.erSRL;
                  const hasCap = emp.monthlySalary > TSS_CEILINGS.sfs || emp.monthlySalary > TSS_CEILINGS.afp;
                  return (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{cleanCedula(emp.cedula)}</TableCell>
                      <TableCell>
                        {emp.name}
                        {hasCap && <span className="ml-1 text-xs text-destructive" title={t("tss.salaryCap")}>⚠</span>}
                        {emp.source === "estimate" && <span className="ml-1 text-xs text-muted-foreground" title={t("tss.estimateNoPayroll")}>~</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(emp.monthlySalary)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(c.empSFS)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(c.empAFP)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(c.erSFS)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(c.erAFP)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(c.erSRL)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmt(total)}</TableCell>
                    </TableRow>
                  );
                })}
                {tssRows.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {t("tss.noActiveEmployees")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {tssRows.length > 0 && (() => {
                const totals = tssRows.reduce(
                  (acc, e) => {
                    const c = calcTssForEmployee(e.monthlySalary);
                    acc.salary += e.monthlySalary;
                    acc.empSFS += c.empSFS; acc.empAFP += c.empAFP;
                    acc.erSFS += c.erSFS; acc.erAFP += c.erAFP; acc.erSRL += c.erSRL;
                    return acc;
                  },
                  { salary: 0, empSFS: 0, empAFP: 0, erSFS: 0, erAFP: 0, erSRL: 0 }
                );
                const grandTotal = totals.empSFS + totals.empAFP + totals.erSFS + totals.erAFP + totals.erSRL;
                return (
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell colSpan={3}>{t("tss.totals")}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.salary)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.empSFS)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.empAFP)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.erSFS)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.erAFP)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.erSRL)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(grandTotal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                );
              })()}
            </Table>
          </div>

          {tssRows.length > 0 && (() => {
            const totals = tssRows.reduce(
              (acc, e) => {
                const c = calcTssForEmployee(e.monthlySalary);
                acc.empSFS += c.empSFS; acc.empAFP += c.empAFP;
                acc.erSFS += c.erSFS; acc.erAFP += c.erAFP; acc.erSRL += c.erSRL;
                return acc;
              },
              { empSFS: 0, empAFP: 0, erSFS: 0, erAFP: 0, erSRL: 0 }
            );
            const totalEmployee = totals.empSFS + totals.empAFP;
            const totalEmployer = totals.erSFS + totals.erAFP + totals.erSRL;
            const autorizacion = totalEmployee + totalEmployer;

            const monthLabel = months.find(m => m.value === selectedMonth)?.label || "";

            return (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {t("tss.paymentAuth")} — {monthLabel} {selectedYear}
                    {!hasAnySnapshot && <span className="text-sm font-normal text-muted-foreground ml-2">({t("ir17.estimated")})</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tss.employeeContribution")}</p>
                      <p className="text-sm font-mono">(SFS {fmt(totals.empSFS)} + AFP {fmt(totals.empAFP)})</p>
                      <p className="text-lg font-semibold font-mono">RD$ {fmt(totalEmployee)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tss.employerContribution")}</p>
                      <p className="text-sm font-mono">(SFS {fmt(totals.erSFS)} + AFP {fmt(totals.erAFP)} + SRL {fmt(totals.erSRL)})</p>
                      <p className="text-lg font-semibold font-mono">RD$ {fmt(totalEmployer)}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-2 sm:text-right">
                      <p className="text-xs text-muted-foreground">{t("tss.totalPaymentAuth")}</p>
                      <p className="text-2xl font-bold font-mono text-primary">RD$ {fmt(autorizacion)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("tss.ceilings")}: SFS ≤ {fmt(TSS_CEILINGS.sfs)} · AFP ≤ {fmt(TSS_CEILINGS.afp)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {showPreview && fileContent && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t("tss.filePreview")}</h4>
              <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-auto max-h-[400px] whitespace-pre">
                {fileContent}
              </pre>
              <p className="text-xs text-muted-foreground">
                {t("tss.suggestedName")}: AM_{EMPLOYER_RNC}_{periodo}.txt — {fileContent.split("\n").length} {t("tss.lines")},{" "}
                {tssRows.length} {t("tss.employees")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
