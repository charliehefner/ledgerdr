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
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEntity } from "@/contexts/EntityContext";

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
  const [letterType, setLetterType] = useState("contrato");
  const [generating, setGenerating] = useState(false);

  // Hiring fields
  const [address, setAddress] = useState("");
  const [benefits, setBenefits] = useState("");
  const [trialMonths, setTrialMonths] = useState("3");
  const [companyName, setCompanyName] = useState("");
  const [companyRnc, setCompanyRnc] = useState("");
  const [companyRnl, setCompanyRnl] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [repName, setRepName] = useState("");
  const [repNationality, setRepNationality] = useState("");
  const [repDocument, setRepDocument] = useState("");
  const [repTitle, setRepTitle] = useState("Gerente General");

  // Termination fields
  const [terminationDate, setTerminationDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [motive, setMotive] = useState("renuncia");
  const [motiveDetail, setMotiveDetail] = useState("");

  // Bank letter fields
  const [bankName, setBankName] = useState("");
  const [bankLetterDate, setBankLetterDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Vacation fields
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationLetterDate, setVacationLetterDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Load entity info for company fields
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
      };

      if (letterType === "contrato") {
        if (!companyName || !companyRnc) {
          toast.error("Nombre y RNC de la empresa son requeridos");
          setGenerating(false);
          return;
        }
        payload = {
          ...payload,
          salary: employee.salary,
          start_date: employee.date_of_hire,
          benefits,
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
          motive,
          motive_detail: motiveDetail,
          company_name: companyName,
          company_rnc: companyRnc,
        };
      } else if (letterType === "carta_banco") {
        if (!bankName) {
          toast.error("El nombre del banco es requerido");
          setGenerating(false);
          return;
        }
        payload = {
          ...payload,
          salary: employee.salary,
          start_date: employee.date_of_hire,
          company_name: companyName,
          company_rnc: companyRnc,
          bank_name: bankName,
          letter_date: bankLetterDate,
        };
      } else if (letterType === "vacaciones") {
        if (!vacationStart || !vacationEnd) {
          toast.error("Las fechas de vacaciones son requeridas");
          setGenerating(false);
          return;
        }
        payload = {
          ...payload,
          vacation_start: vacationStart,
          vacation_end: vacationEnd,
          company_name: companyName,
          company_rnc: companyRnc,
          letter_date: vacationLetterDate,
        };
      }

      const { data, error } = await supabase.functions.invoke(
        "generate-hr-letter",
        { body: payload }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Carta generada exitosamente");
      queryClient.invalidateQueries({
        queryKey: ["employee-documents", employee.id],
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error generating letter:", err);
      toast.error("Error al generar carta: " + (err.message || "Unknown error"));
    } finally {
      setGenerating(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generar Carta — {employee.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={letterType} onValueChange={setLetterType}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
            <TabsTrigger value="terminacion">Terminación</TabsTrigger>
            <TabsTrigger value="carta_banco">Banco</TabsTrigger>
            <TabsTrigger value="vacaciones">Vacaciones</TabsTrigger>
          </TabsList>

          {/* Hiring Contract */}
          <TabsContent value="contrato" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Empleado</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>Cédula</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>Posición</Label>
                <Input value={employee.position} disabled />
              </div>
              <div>
                <Label>Salario Mensual (DOP)</Label>
                <Input
                  value={employee.salary.toLocaleString()}
                  disabled
                />
              </div>
              <div>
                <Label>Fecha de Inicio</Label>
                <Input value={employee.date_of_hire} disabled />
              </div>
              <div>
                <Label>Período de Prueba (meses)</Label>
                <Input
                  type="number"
                  value={trialMonths}
                  onChange={(e) => setTrialMonths(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Dirección del Trabajador</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: casa 10/14 La Paloma, Los Llanos RD"
              />
            </div>

            <div>
              <Label>Beneficios Adicionales (SEGUNDO)</Label>
              <Textarea
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                placeholder="Ej: EL TRABAJADOR recibe como beneficios un adicional de..."
                rows={3}
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                Datos de la Empresa
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre de la Empresa</Label>
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
                  <Label>Dirección de la Empresa</Label>
                  <Input
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                Representante Legal
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Nacionalidad</Label>
                  <Input
                    value={repNationality}
                    onChange={(e) => setRepNationality(e.target.value)}
                    placeholder="Ej: brasileño"
                  />
                </div>
                <div>
                  <Label>Documento</Label>
                  <Input
                    value={repDocument}
                    onChange={(e) => setRepDocument(e.target.value)}
                    placeholder="Ej: pasaporte GI 449837"
                  />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input
                    value={repTitle}
                    onChange={(e) => setRepTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Termination */}
          <TabsContent value="terminacion" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Empleado</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>Cédula</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>Fecha de Terminación</Label>
                <Input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Motivo</Label>
                <Select value={motive} onValueChange={setMotive}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="renuncia">Renuncia</SelectItem>
                    <SelectItem value="despido">Despido</SelectItem>
                    <SelectItem value="mutuo_acuerdo">
                      Mutuo Acuerdo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Detalle del Motivo (opcional)</Label>
              <Textarea
                value={motiveDetail}
                onChange={(e) => setMotiveDetail(e.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>

          {/* Bank Letter */}
          <TabsContent value="carta_banco" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Empleado</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>Cédula</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>Posición</Label>
                <Input value={employee.position} disabled />
              </div>
              <div>
                <Label>Salario Mensual (DOP)</Label>
                <Input
                  value={employee.salary.toLocaleString()}
                  disabled
                />
              </div>
              <div>
                <Label>Banco</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ej: Banco Popular Dominicano"
                />
              </div>
              <div>
                <Label>Fecha de la Carta</Label>
                <Input
                  type="date"
                  value={bankLetterDate}
                  onChange={(e) => setBankLetterDate(e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          {/* Vacation */}
          <TabsContent value="vacaciones" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Empleado</Label>
                <Input value={employee.name} disabled />
              </div>
              <div>
                <Label>Cédula</Label>
                <Input value={employee.cedula} disabled />
              </div>
              <div>
                <Label>Inicio de Vacaciones</Label>
                <Input
                  type="date"
                  value={vacationStart}
                  onChange={(e) => setVacationStart(e.target.value)}
                />
              </div>
              <div>
                <Label>Fin de Vacaciones</Label>
                <Input
                  type="date"
                  value={vacationEnd}
                  onChange={(e) => setVacationEnd(e.target.value)}
                />
              </div>
              <div>
                <Label>Fecha de la Carta</Label>
                <Input
                  type="date"
                  value={vacationLetterDate}
                  onChange={(e) => setVacationLetterDate(e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
