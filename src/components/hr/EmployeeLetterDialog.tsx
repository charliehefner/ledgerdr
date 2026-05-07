import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEntity } from "@/contexts/EntityContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Clause {
  title: string;
  body: string;
}

const CLAUSE_TEMPLATES: { labelKey: string; title: string; body: string }[] = [
  { labelKey: "letter.cellPhone", title: "Beneficios", body: "EL TRABAJADOR recibirá un teléfono celular para uso laboral." },
  { labelKey: "letter.fuelExpenses", title: "Beneficios", body: "LA EMPRESA cubrirá los gastos de combustible del TRABAJADOR para fines laborales." },
  { labelKey: "letter.companyVehicle", title: "Beneficios", body: "LA EMPRESA proporcionará un vehículo para uso del TRABAJADOR en el desempeño de sus funciones." },
  { labelKey: "letter.responsibilities", title: "Responsabilidades", body: "EL TRABAJADOR será responsable de " },
  { labelKey: "letter.workSchedule", title: "Condiciones", body: "El horario de trabajo será de lunes a viernes de 7:30 AM a 4:30 PM y sábados de 7:30 AM a 11:30 AM." },
];

interface EmployeeLetterDialogProps {
  employee: {
    id: string;
    name: string;
    cedula: string;
    position: string;
    salary: number;
    date_of_hire: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeLetterDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeLetterDialogProps) {
  const queryClient = useQueryClient();
  const { selectedEntityId } = useEntity();
  const { t } = useLanguage();
  const [letterType, setLetterType] = useState("contrato");
  const [generating, setGenerating] = useState(false);

  // Hiring fields
  const [address, setAddress] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [trialMonths, setTrialMonths] = useState("3");
  const [companyName, setCompanyName] = useState("Jord Dominicana, srl");
  const [companyRnc, setCompanyRnc] = useState("1-32-21404-8");
  const [companyRnl, setCompanyRnl] = useState("132214048-0001");
  const [companyAddress, setCompanyAddress] = useState("Calle Principal #1, Paraje La Yeguada, San José de Los Llanos, SPM");
  const [repName, setRepName] = useState("");
  const [repNationality, setRepNationality] = useState("");
  const [repDocument, setRepDocument] = useState("");
  const [repTitle, setRepTitle] = useState("Gerente General");

  // Termination fields
  const [terminationDate, setTerminationDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [desahucioType, setDesahucioType] = useState<"immediate" | "preaviso">("immediate");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [preavisoDays, setPreavisoDays] = useState("28");
  const [managerName, setManagerName] = useState("");
  const [managerTitle, setManagerTitle] = useState("Gerente operacional");

  // Bank letter fields
  const [bankName, setBankName] = useState("");
  const [bankLetterDate, setBankLetterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("Gerente General");

  // Vacation fields
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationReturnDate, setVacationReturnDate] = useState("");
  const [vacationDays, setVacationDays] = useState("14");
  const [vacationPeriod, setVacationPeriod] = useState("");
  const [vacationLetterDate, setVacationLetterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [vacationManagerName, setVacationManagerName] = useState("");
  const [vacationManagerTitle, setVacationManagerTitle] = useState("Gerente operacional");

  useEffect(() => {
    if (!selectedEntityId || !open) return;
    supabase
      .from("entities")
      .select("name, rnc")
      .eq("id", selectedEntityId)
      .single()
      .then(({ data }) => {
        if (data) {
          setCompanyName(data.name);
          setCompanyRnc(data.rnc || "");
        }
      });
  }, [selectedEntityId, open]);

  const addClause = (template?: typeof CLAUSE_TEMPLATES[number]) => {
    setClauses((prev) => [
      ...prev,
      template
        ? { title: template.title, body: template.body }
        : { title: "Beneficios", body: "" },
    ]);
  };

  const updateClause = (index: number, field: keyof Clause, value: string) => {
    setClauses((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const removeClause = (index: number) => {
    setClauses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!employee) return;
    setGenerating(true);

    try {
      let payload: Record<string, unknown> = {
        letter_type: letterType,
        employee_id: employee.id,
        employee_name: employee.name,
        cedula: employee.cedula,
        position: employee.position,
        entity_id: selectedEntityId,
      };

      if (letterType === "contrato") {
        if (!companyName || !companyRnc) {
          toast.error(t("letter.companyRncRequired"));
          setGenerating(false);
          return;
        }
        payload = {
          ...payload,
          salary: employee.salary,
          start_date: employee.date_of_hire,
          clauses,
          address,
          company_name: companyName,
          company_rnc: companyRnc,
          company_rnl: companyRnl,
          company_address: companyAddress,
          representative_name: repName,
          representative_nationality: repNationality,
          representative_document: repDocument,
          representative_title: repTitle,
          trial_period_months: parseInt(trialMonths) || 0,
        };
      } else if (letterType === "terminacion") {
        payload = {
          ...payload,
          termination_date: terminationDate,
          desahucio_type: desahucioType,
          last_working_day: lastWorkingDay,
          preaviso_days: desahucioType === "preaviso" ? parseInt(preavisoDays) || 28 : 0,
          company_name: companyName,
          company_rnc: companyRnc,
          manager_name: managerName,
          manager_title: managerTitle,
        };
      } else if (letterType === "carta_banco") {
        if (!bankName) {
          toast.error(t("letter.bankRequired"));
          setGenerating(false);
          return;
        }
        payload = {
          ...payload,
          salary: employee.salary,
          start_date: employee.date_of_hire,
          company_name: companyName,
          company_rnc: companyRnc,
          company_address: companyAddress,
          bank_name: bankName,
          letter_date: bankLetterDate,
          signer_name: signerName,
          signer_title: signerTitle,
        };
      } else if (letterType === "vacaciones") {
        if (!vacationStart || !vacationEnd) {
          toast.error(t("letter.vacationDatesRequired"));
          setGenerating(false);
          return;
        }
        payload = {
          ...payload,
          vacation_start: vacationStart,
          vacation_end: vacationEnd,
          vacation_return_date: vacationReturnDate,
          vacation_days: parseInt(vacationDays) || 14,
          vacation_period: vacationPeriod,
          company_name: companyName,
          company_rnc: companyRnc,
          letter_date: vacationLetterDate,
          manager_name: vacationManagerName,
          manager_title: vacationManagerTitle,
        };
      }

      const { data, error } = await supabase.functions.invoke(
        "generate-hr-letter",
        { body: payload }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(t("letter.generated"));
      queryClient.invalidateQueries({
        queryKey: ["employee-documents", employee.id],
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error generating letter:", err);
      toast.error(t("letter.generateError") + (err.message || "Unknown error"));
    } finally {
      setGenerating(false);
    }
  };

  if (!employee) return null;

  const ordinals = ["SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO", "OCTAVO", "NOVENO", "DÉCIMO"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("letter.title").replace("{name}", employee.name)}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={letterType} onValueChange={setLetterType}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contrato">{t("letter.contract")}</TabsTrigger>
            <TabsTrigger value="terminacion">{t("letter.termination")}</TabsTrigger>
            <TabsTrigger value="carta_banco">{t("letter.bankLetter")}</TabsTrigger>
            <TabsTrigger value="vacaciones">{t("letter.vacation")}</TabsTrigger>
          </TabsList>

          {/* Hiring Contract */}
          <TabsContent value="contrato" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("letter.employeeName")}</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>{t("employees.cedula")}</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>{t("letter.position")}</Label>
                <Input value={employee.position} disabled />
              </div>
              <div>
                <Label>{t("letter.monthlySalary")}</Label>
                <Input value={employee.salary.toLocaleString()} disabled />
              </div>
              <div>
                <Label>{t("letter.startDate")}</Label>
                <Input value={employee.date_of_hire} disabled />
              </div>
              <div>
                <Label>{t("letter.trialPeriod")}</Label>
                <Input
                  type="number"
                  value={trialMonths}
                  onChange={(e) => setTrialMonths(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>{t("letter.workerAddress")}</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: casa 10/14 La Paloma, Los Llanos RD"
              />
            </div>

            {/* Dynamic Clauses */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-muted-foreground">
                  {t("letter.additionalClauses")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addClause()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("letter.addClause")}
                </Button>
              </div>

              {/* Quick-add templates */}
              <div className="flex flex-wrap gap-2 mb-3">
                {CLAUSE_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl.labelKey}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() => addClause(tpl)}
                  >
                    + {t(tpl.labelKey)}
                  </Button>
                ))}
              </div>

              {clauses.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  {t("letter.noClausesHint")}
                </p>
              )}

              <div className="space-y-3">
                {clauses.map((clause, idx) => {
                  const label = ordinals[idx] || `CLÁUSULA ${idx + 2}`;
                  return (
                    <div key={idx} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">{label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeClause(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">{t("letter.clauseType")}</Label>
                        <Select
                          value={clause.title}
                          onValueChange={(v) => updateClause(idx, "title", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Beneficios">{t("letter.benefits")}</SelectItem>
                            <SelectItem value="Responsabilidades">{t("letter.responsibilities")}</SelectItem>
                            <SelectItem value="Condiciones">{t("letter.conditions")}</SelectItem>
                            <SelectItem value="Otro">{t("letter.other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t("letter.clauseContent")}</Label>
                        <Textarea
                          value={clause.body}
                          onChange={(e) => updateClause(idx, "body", e.target.value)}
                          rows={3}
                          placeholder={t("letter.clausePlaceholder")}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                {t("letter.companyData")}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("letter.companyName")}</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>RNC</Label>
                  <Input
                    value={companyRnc}
                    onChange={(e) => setCompanyRnc(e.target.value)}
                  />
                </div>
                <div>
                  <Label>RNL</Label>
                  <Input
                    value={companyRnl}
                    onChange={(e) => setCompanyRnl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("letter.companyAddress")}</Label>
                  <Input
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                {t("letter.legalRep")}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("common.name")}</Label>
                  <Input
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("letter.nationality")}</Label>
                  <Input
                    value={repNationality}
                    onChange={(e) => setRepNationality(e.target.value)}
                    placeholder="Ej: brasileño"
                  />
                </div>
                <div>
                  <Label>{t("letter.document")}</Label>
                  <Input
                    value={repDocument}
                    onChange={(e) => setRepDocument(e.target.value)}
                    placeholder="Ej: pasaporte GI 449837"
                  />
                </div>
                <div>
                  <Label>{t("letter.title2")}</Label>
                  <Input
                    value={repTitle}
                    onChange={(e) => setRepTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Termination - Desahucio */}
          <TabsContent value="terminacion" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("letter.employeeName")}</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>{t("employees.cedula")}</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>{t("letter.noticeDate")}</Label>
                <Input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("letter.terminationType")}</Label>
                <Select value={desahucioType} onValueChange={(v) => setDesahucioType(v as "immediate" | "preaviso")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">{t("letter.immediateTermination")}</SelectItem>
                    <SelectItem value="preaviso">{t("letter.preavisoTermination")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("letter.lastWorkingDay")}</Label>
                <Input
                  type="date"
                  value={lastWorkingDay}
                  onChange={(e) => setLastWorkingDay(e.target.value)}
                />
              </div>
              {desahucioType === "preaviso" && (
                <div>
                  <Label>{t("letter.preavisoDays")}</Label>
                  <Input
                    type="number"
                    value={preavisoDays}
                    onChange={(e) => setPreavisoDays(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">{t("letter.signers")}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("letter.managerName")}</Label>
                  <Input
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Ej: Reynaldo Cedeño Class"
                  />
                </div>
                <div>
                  <Label>{t("letter.managerTitle")}</Label>
                  <Input
                    value={managerTitle}
                    onChange={(e) => setManagerTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bank Letter */}
          <TabsContent value="carta_banco" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("letter.employeeName")}</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>{t("employees.cedula")}</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>{t("letter.position")}</Label>
                <Input value={employee.position} disabled />
              </div>
              <div>
                <Label>{t("letter.monthlySalary")}</Label>
                <Input value={employee.salary.toLocaleString()} disabled />
              </div>
              <div>
                <Label>{t("letter.bankName")}</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ej: Banco BHD"
                />
              </div>
              <div>
                <Label>{t("letter.letterDate")}</Label>
                <Input
                  type="date"
                  value={bankLetterDate}
                  onChange={(e) => setBankLetterDate(e.target.value)}
                />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">{t("letter.signer")}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("letter.signerName")}</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Ej: Charles Russell Hefner"
                  />
                </div>
                <div>
                  <Label>{t("letter.signerTitle")}</Label>
                  <Input
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Vacation */}
          <TabsContent value="vacaciones" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("letter.employeeName")}</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>{t("employees.cedula")}</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>{t("letter.vacationStart")}</Label>
                <Input
                  type="date"
                  value={vacationStart}
                  onChange={(e) => setVacationStart(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("letter.vacationEnd")}</Label>
                <Input
                  type="date"
                  value={vacationEnd}
                  onChange={(e) => setVacationEnd(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("letter.returnDate")}</Label>
                <Input
                  type="date"
                  value={vacationReturnDate}
                  onChange={(e) => setVacationReturnDate(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("letter.workDays")}</Label>
                <Input
                  type="number"
                  value={vacationDays}
                  onChange={(e) => setVacationDays(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("letter.period")}</Label>
                <Input
                  value={vacationPeriod}
                  onChange={(e) => setVacationPeriod(e.target.value)}
                  placeholder="2024/2025"
                />
              </div>
              <div>
                <Label>{t("letter.letterDate")}</Label>
                <Input
                  type="date"
                  value={vacationLetterDate}
                  onChange={(e) => setVacationLetterDate(e.target.value)}
                />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">{t("letter.signers")}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("letter.managerName")}</Label>
                  <Input
                    value={vacationManagerName}
                    onChange={(e) => setVacationManagerName(e.target.value)}
                    placeholder="Ej: Reynaldo Cedeño Class"
                  />
                </div>
                <div>
                  <Label>{t("letter.managerTitle")}</Label>
                  <Input
                    value={vacationManagerTitle}
                    onChange={(e) => setVacationManagerTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("letter.generating")}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {t("letter.generatePdf")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
