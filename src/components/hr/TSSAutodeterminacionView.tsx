import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Eye, FileText } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { toast } from "sonner";

// DR TSS contribution rates
const TSS_RATES = {
  // Employee contributions
  empSFS: 0.0304,   // 3.04%
  empAFP: 0.0287,   // 2.87%
  // Employer contributions
  erSFS: 0.0709,    // 7.09%
  erAFP: 0.0710,    // 7.10%
  erSRL: 0.0110,    // 1.10%
};

// TSS salary ceilings (monthly) — 2025 values based on minimum wage RD$21,000 private sector
// SFS ceiling: 10× minimum wage = RD$210,000 (applies to both employee and employer SFS)
// AFP ceiling: 20× minimum wage = RD$420,000 (applies to both employee and employer AFP)
// SRL: no ceiling (applies on full salary)
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
  const erSRL = salary * TSS_RATES.erSRL; // no ceiling

  return { empSFS, empAFP, erSFS, erAFP, erSRL, sfsSalary, afpSalary };
}

// Hardcoded employer RNC — move to settings later
const EMPLOYER_RNC = "132214048";

/**
 * Pad/truncate string to exact length, left or right justified
 */
function padRight(str: string, len: number): string {
  return (str || "").substring(0, len).padEnd(len, " ");
}

function padLeft(str: string, len: number, fill = " "): string {
  return (str || "").substring(0, len).padStart(len, fill);
}

/**
 * Format a number as fixed-width with 2 decimals, zero-padded left
 * e.g. 15000 → "0000000015000.00" (16 chars)
 */
function formatAmount(amount: number, len = 16): string {
  const fixed = Math.max(0, amount).toFixed(2);
  return fixed.padStart(len, "0");
}

/**
 * Format date as DDMMAAAA
 */
function formatDateDDMMAAAA(dateStr: string | null): string {
  if (!dateStr) return "00000000";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

/**
 * Clean cédula: remove dashes/spaces
 */
function cleanCedula(cedula: string): string {
  return (cedula || "").replace(/[-\s]/g, "");
}

/**
 * Split full name into parts
 */
function splitName(fullName: string): { nombres: string; apellido1: string; apellido2: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length <= 2) {
    return { nombres: parts[0] || "", apellido1: parts[1] || "", apellido2: "" };
  }
  if (parts.length === 3) {
    return { nombres: parts[0], apellido1: parts[1], apellido2: parts[2] };
  }
  // 4+ parts: first two are names, rest are surnames
  return {
    nombres: parts.slice(0, 2).join(" "),
    apellido1: parts[2] || "",
    apellido2: parts.slice(3).join(" "),
  };
}

interface EmployeeRow {
  id: string;
  name: string;
  cedula: string;
  salary: number;
  date_of_birth: string | null;
  is_active: boolean;
}

function generateEncabezado(rnc: string, periodo: string): string {
  // E + AM + RNC(11) + Periodo(MMAAAA) = 20 chars
  return "E" + "AM" + padLeft(rnc, 11) + periodo;
}

function generateDetalle(emp: EmployeeRow, claveNomina = "001"): string {
  const { nombres, apellido1, apellido2 } = splitName(emp.name);
  const cedula = cleanCedula(emp.cedula);
  const salarioSS = formatAmount(emp.salary);

  let line = "D"; // 1: tipo registro
  line += padLeft(claveNomina, 3, "0"); // 2-4: clave nómina
  line += "C"; // 5: tipo documento (C=Cédula)
  line += padRight(cedula, 25); // 6-30: número documento
  line += padRight(nombres, 50); // 31-80: nombres
  line += padRight(apellido1, 40); // 81-120: primer apellido
  line += padRight(apellido2, 40); // 121-160: segundo apellido
  line += " "; // 161: sexo (blank = not specified)
  line += formatDateDDMMAAAA(emp.date_of_birth); // 162-169: fecha nacimiento
  line += salarioSS; // 170-185: Salario_SS
  line += formatAmount(0); // 186-201: Aporte voluntario
  line += formatAmount(0); // 202-217: Salario_ISR (0 = same as SS)
  line += formatAmount(0); // 218-233: Otras remuneraciones ISR
  line += padLeft("", 11); // 234-244: RNC agente retención
  line += formatAmount(0); // 245-260: Remuneraciones otros empleadores
  line += formatAmount(0); // 261-276: Ingresos exentos ISR
  line += formatAmount(0); // 277-292: Saldo a favor
  line += formatAmount(0); // 293-308: Salario INFOTEP
  line += "0001"; // 309-312: Tipo ingreso (Normal)
  line += "01" + formatAmount(0); // 313-330: Regalía pascual (code 01 + amount)
  line += "02" + formatAmount(0); // 331-348: Preaviso/cesantía (code 02 + amount)
  line += "03" + formatAmount(0); // 349-366: Pensión alimenticia (code 03 + amount)

  return line;
}

function generateSumario(totalRecords: number): string {
  // S + count(6) = 7 chars
  return "S" + String(totalRecords).padStart(6, "0");
}

export function TSSAutodeterminacionView() {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showPreview, setShowPreview] = useState(false);

  const periodo = `${selectedMonth}${selectedYear}`; // MMAAAA

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-tss"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, cedula, salary, date_of_birth, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as EmployeeRow[];
    },
  });

  const fileContent = useMemo(() => {
    if (employees.length === 0) return "";
    const lines: string[] = [];
    lines.push(generateEncabezado(EMPLOYER_RNC, periodo));
    employees.forEach((emp) => {
      lines.push(generateDetalle(emp));
    });
    const totalRecords = lines.length + 1; // +1 for sumario itself
    lines.push(generateSumario(totalRecords));
    return lines.join("\n");
  }, [employees, periodo]);

  const handleDownload = () => {
    if (!fileContent) {
      toast.error("No hay empleados activos para generar el archivo");
      return;
    }
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const fileName = `AM_${EMPLOYER_RNC}_${selectedMonth}${selectedYear}.txt`;

    // Try File System Access API for Save As
    if ("showSaveFilePicker" in window) {
      (window as any)
        .showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Text file", accept: { "text/plain": [".txt"] } }],
        })
        .then(async (handle: any) => {
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success("Archivo TSS generado exitosamente");
        })
        .catch(() => {
          // User cancelled or fallback
          fallbackDownload(blob, fileName);
        });
    } else {
      fallbackDownload(blob, fileName);
    }
  };

  const fallbackDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo TSS generado exitosamente");
  };

  const months = [
    { value: "01", label: "Enero" },
    { value: "02", label: "Febrero" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Mayo" },
    { value: "06", label: "Junio" },
    { value: "07", label: "Julio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            TSS — Autodeterminación Mensual (AM)
            <InfoTooltip translationKey="help.tss" />
          </CardTitle>
          <CardDescription>
            Genera el archivo de texto (.txt) de Autodeterminación Mensual para cargar al SUIRPLUS de la TSS.
            Formato según Instructivo v6 (junio 2025).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period selector */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Mes</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Año</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Ocultar Vista Previa" : "Vista Previa"}
            </Button>

            <Button onClick={handleDownload} disabled={employees.length === 0 || isLoading}>
              <Download className="h-4 w-4 mr-2" />
              Descargar AM_{EMPLOYER_RNC}_{periodo}.txt
            </Button>
          </div>

          {/* Employee summary table */}
          <div className="text-sm text-muted-foreground">
            {isLoading ? "Cargando empleados..." : `${employees.length} empleados activos en nómina`}
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Salario</TableHead>
                  <TableHead className="text-right">SFS Emp (3.04%)</TableHead>
                  <TableHead className="text-right">AFP Emp (2.87%)</TableHead>
                  <TableHead className="text-right">SFS Pat (7.09%)</TableHead>
                  <TableHead className="text-right">AFP Pat (7.10%)</TableHead>
                  <TableHead className="text-right">SRL Pat (1.10%)</TableHead>
                  <TableHead className="text-right font-semibold">Total TSS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp, idx) => {
                  const c = calcTssForEmployee(emp.salary);
                  const total = c.empSFS + c.empAFP + c.erSFS + c.erAFP + c.erSRL;
                  const hasCap = emp.salary > TSS_CEILINGS.sfs || emp.salary > TSS_CEILINGS.afp;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{cleanCedula(emp.cedula)}</TableCell>
                      <TableCell>
                        {emp.name}
                        {hasCap && <span className="ml-1 text-xs text-warning" title="Tope salarial aplicado">⚠</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {emp.salary.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.empSFS.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.empAFP.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.erSFS.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.erAFP.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.erSRL.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {employees.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No hay empleados activos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {employees.length > 0 && (() => {
                const totals = employees.reduce(
                  (acc, e) => {
                    const c = calcTssForEmployee(e.salary);
                    acc.salary += e.salary;
                    acc.empSFS += c.empSFS;
                    acc.empAFP += c.empAFP;
                    acc.erSFS += c.erSFS;
                    acc.erAFP += c.erAFP;
                    acc.erSRL += c.erSRL;
                    return acc;
                  },
                  { salary: 0, empSFS: 0, empAFP: 0, erSFS: 0, erAFP: 0, erSRL: 0 }
                );
                const grandTotal = totals.empSFS + totals.empAFP + totals.erSFS + totals.erAFP + totals.erSRL;
                return (
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell colSpan={3}>Totales</TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.salary.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.empSFS.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.empAFP.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.erSFS.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.erAFP.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.erSRL.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {grandTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                );
              })()}
            </Table>
          </div>

          {/* Autorización de Pago summary */}
          {employees.length > 0 && (() => {
            const totals = employees.reduce(
              (acc, e) => {
                const c = calcTssForEmployee(e.salary);
                acc.empSFS += c.empSFS;
                acc.empAFP += c.empAFP;
                acc.erSFS += c.erSFS;
                acc.erAFP += c.erAFP;
                acc.erSRL += c.erSRL;
                return acc;
              },
              { empSFS: 0, empAFP: 0, erSFS: 0, erAFP: 0, erSRL: 0 }
            );
            const totalEmployee = totals.empSFS + totals.empAFP;
            const totalEmployer = totals.erSFS + totals.erAFP + totals.erSRL;
            const autorizacion = totalEmployee + totalEmployer;
            const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2 });

            return (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Autorización de Pago TSS — {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Aporte Empleado</p>
                      <p className="text-sm font-mono">(SFS {fmt(totals.empSFS)} + AFP {fmt(totals.empAFP)})</p>
                      <p className="text-lg font-semibold font-mono">RD$ {fmt(totalEmployee)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Aporte Patronal</p>
                      <p className="text-sm font-mono">(SFS {fmt(totals.erSFS)} + AFP {fmt(totals.erAFP)} + SRL {fmt(totals.erSRL)})</p>
                      <p className="text-lg font-semibold font-mono">RD$ {fmt(totalEmployer)}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-2 sm:text-right">
                      <p className="text-xs text-muted-foreground">Total Autorización de Pago</p>
                      <p className="text-2xl font-bold font-mono text-primary">RD$ {fmt(autorizacion)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Topes aplicados: SFS ≤ {fmt(TSS_CEILINGS.sfs)} · AFP ≤ {fmt(TSS_CEILINGS.afp)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Raw file preview */}
          {showPreview && fileContent && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Vista previa del archivo .txt</h4>
              <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-auto max-h-[400px] whitespace-pre">
                {fileContent}
              </pre>
              <p className="text-xs text-muted-foreground">
                Nombre sugerido: AM_{EMPLOYER_RNC}_{periodo}.txt — {fileContent.split("\n").length} líneas,{" "}
                {employees.length} empleados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
