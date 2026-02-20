import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DGII606Table } from "./DGII606Table";
import { DGII607Table } from "./DGII607Table";
import { DGII608Table } from "./DGII608Table";
import { IT1ReportView } from "./IT1ReportView";
import { IR3ReportView } from "@/components/hr/IR3ReportView";
import { Loader2 } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function DGIIReportsView() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [subTab, setSubTab] = useState("606");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [voided, setVoided] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch purchases (606)
      const { data: purchaseData } = await supabase
        .from("transactions")
        .select("id, rnc, document, transaction_date, amount, itbis, itbis_retenido, isr_retenido, pay_method, dgii_tipo_bienes_servicios, name")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false)
        .or("transaction_direction.eq.purchase,transaction_direction.is.null")
        .not("document", "is", null)
        .order("transaction_date");

      // Fetch sales (607)
      const { data: salesData } = await supabase
        .from("transactions")
        .select("id, rnc, document, transaction_date, amount, itbis, itbis_retenido, isr_retenido, dgii_tipo_ingreso, name")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false)
        .eq("transaction_direction", "sale")
        .not("document", "is", null)
        .order("transaction_date");

      // Fetch voided (608)
      const { data: voidedData } = await supabase
        .from("transactions")
        .select("id, document, transaction_date, dgii_tipo_anulacion")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", true)
        .not("document", "is", null)
        .order("transaction_date");

      setPurchases(purchaseData || []);
      setSales(salesData || []);
      setVoided(voidedData || []);
    } catch (error) {
      console.error("Error fetching DGII data:", error);
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reportes DGII</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label>Mes</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Año</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={subTab} onValueChange={setSubTab}>
              <TabsList>
                <TabsTrigger value="606" className="gap-1">606 - Compras ({purchases.length}) <InfoTooltip translationKey="help.dgii606" /></TabsTrigger>
                <TabsTrigger value="607" className="gap-1">607 - Ventas ({sales.length}) <InfoTooltip translationKey="help.dgii607" /></TabsTrigger>
                <TabsTrigger value="608" className="gap-1">608 - Anulados ({voided.length}) <InfoTooltip translationKey="help.dgii608" /></TabsTrigger>
                <TabsTrigger value="it1" className="gap-1">IT-1 - ITBIS <InfoTooltip translationKey="help.it1" /></TabsTrigger>
                <TabsTrigger value="ir3" className="gap-1">IR-3 - ISR <InfoTooltip translationKey="help.ir3" /></TabsTrigger>
              </TabsList>
              <TabsContent value="606">
                <DGII606Table transactions={purchases} month={month} year={year} />
              </TabsContent>
              <TabsContent value="607">
                <DGII607Table transactions={sales} month={month} year={year} />
              </TabsContent>
              <TabsContent value="608">
                <DGII608Table transactions={voided} month={month} year={year} />
              </TabsContent>
              <TabsContent value="it1">
                <IT1ReportView purchases={purchases} sales={sales} month={month} year={year} />
              </TabsContent>
              <TabsContent value="ir3">
                <IR3ReportView />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
