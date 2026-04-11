import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { DGII606Table } from "./DGII606Table";
import { DGII607Table } from "./DGII607Table";
import { DGII608Table } from "./DGII608Table";
import { IT1ReportView } from "./IT1ReportView";
import { IR3ReportView } from "@/components/hr/IR3ReportView";
import { IR17ReportView } from "@/components/hr/IR17ReportView";
import { Loader2, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useEntity } from "@/contexts/EntityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BankAccountForDGII } from "./dgiiConstants";

export function DGIIReportsView() {
  const { t } = useLanguage();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [subTab, setSubTab] = useState("606");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [voided, setVoided] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { selectedEntityId } = useEntity();

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: t(`month.${String(i + 1).padStart(2, "0")}`),
  }));

  // Check if the selected entity has RNC configured
  const { data: entityRnc } = useQuery({
    queryKey: ["entity-rnc", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const { data, error } = await supabase
        .from("entities")
        .select("rnc")
        .eq("id", selectedEntityId)
        .single();
      if (error) return null;
      return data?.rnc || null;
    },
    enabled: !!selectedEntityId,
  });

  const hasNoRnc = !!selectedEntityId && !entityRnc;

  // Fetch bank accounts for DGII payment method resolution
  const { data: bankAccounts = [] } = useQuery<BankAccountForDGII[]>({
    queryKey: ["bank-accounts-dgii"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_type")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as BankAccountForDGII[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: purchaseData } = await supabase
        .from("transactions")
        .select("id, rnc, document, transaction_date, purchase_date, amount, itbis, itbis_retenido, isr_retenido, pay_method, dgii_tipo_bienes_servicios, name")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false)
        .or("transaction_direction.eq.purchase,transaction_direction.is.null")
        .not("document", "is", null)
        .order("transaction_date")
        .limit(10000);

      const { data: salesData } = await supabase
        .from("transactions")
        .select("id, rnc, document, transaction_date, amount, itbis, itbis_retenido, isr_retenido, dgii_tipo_ingreso, name")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false)
        .eq("transaction_direction", "sale")
        .not("document", "is", null)
        .order("transaction_date")
        .limit(10000);

      const { data: voidedData } = await supabase
        .from("transactions")
        .select("id, document, transaction_date, dgii_tipo_anulacion")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", true)
        .not("document", "is", null)
        .order("transaction_date")
        .limit(10000);

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
          <CardTitle>{t("dgii.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasNoRnc && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t("dgii.rncWarning")}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label>{t("dgii.month")}</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("dgii.year")}</Label>
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
                <TabsTrigger value="606" className="gap-1">{t("dgii.606Purchases")} ({purchases.length}) <InfoTooltip translationKey="help.dgii606" /></TabsTrigger>
                <TabsTrigger value="607" className="gap-1">{t("dgii.607Sales")} ({sales.length}) <InfoTooltip translationKey="help.dgii607" /></TabsTrigger>
                <TabsTrigger value="608" className="gap-1">{t("dgii.608Voided")} ({voided.length}) <InfoTooltip translationKey="help.dgii608" /></TabsTrigger>
                <TabsTrigger value="it1" className="gap-1">{t("dgii.it1Itbis")} <InfoTooltip translationKey="help.it1" /></TabsTrigger>
                <TabsTrigger value="ir3" className="gap-1">{t("dgii.ir3Isr")} <InfoTooltip translationKey="help.ir3" /></TabsTrigger>
                <TabsTrigger value="ir17" className="gap-1">{t("dgii.ir17Withholdings")}</TabsTrigger>
              </TabsList>
              <TabsContent value="606">
                <DGII606Table transactions={purchases} month={month} year={year} bankAccounts={bankAccounts} entityId={selectedEntityId} />
              </TabsContent>
              <TabsContent value="607">
                <DGII607Table transactions={sales} month={month} year={year} entityId={selectedEntityId} />
              </TabsContent>
              <TabsContent value="608">
                <DGII608Table transactions={voided} month={month} year={year} entityId={selectedEntityId} />
              </TabsContent>
              <TabsContent value="it1">
                <IT1ReportView purchases={purchases} sales={sales} month={month} year={year} />
              </TabsContent>
              <TabsContent value="ir3">
                <IR3ReportView />
              </TabsContent>
              <TabsContent value="ir17">
                <IR17ReportView />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
