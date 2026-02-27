import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BarChart3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ExcelJS from "exceljs";

/** Paginated fetch – handles Supabase 1 000-row default limit */
async function fetchAllPages(
  buildQuery: (range: [number, number]) => any,
  pageSize = 1000
): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery([offset, offset + pageSize - 1]);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function supportsFilePicker(): boolean {
  return "showSaveFilePicker" in window;
}

async function saveFileWithPicker(blob: Blob, suggestedName: string): Promise<boolean> {
  if (supportsFilePicker()) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: "Excel Workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
}

export function PowerBIExportButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch all four datasets in parallel
      const [chartOfAccounts, journalsRaw, journalLinesRaw, generalLedger, transactions, coaAll] = await Promise.all([
        // 1. Chart of Accounts
        fetchAllPages(([s, e]: [number, number]) =>
          supabase.from("chart_of_accounts")
            .select("account_code, account_name, account_type, currency, allow_posting, parent_id, english_description, spanish_description")
            .is("deleted_at", null)
            .order("account_code")
            .range(s, e)
        ),
        // 2. Journals (headers)
        fetchAllPages(([s, e]: [number, number]) =>
          supabase.from("journals")
            .select("id, journal_number, journal_type, journal_date, currency, exchange_rate, posted, description")
            .is("deleted_at", null)
            .order("journal_date", { ascending: false })
            .range(s, e)
        ),
        // 3. Journal Lines
        fetchAllPages(([s, e]: [number, number]) =>
          supabase.from("journal_lines")
            .select("journal_id, account_id, project_code, cbs_code, debit, credit")
            .is("deleted_at", null)
            .range(s, e)
        ),
        // 4. General Ledger view
        fetchAllPages(([s, e]: [number, number]) =>
          supabase.from("general_ledger" as any)
            .select("journal_date, journal_number, account_code, account_name, description, debit, credit, debit_base, credit_base, running_balance_base")
            .range(s, e)
        ),
        // 5. Transactions
        fetchAllPages(([s, e]: [number, number]) =>
          supabase.from("transactions")
            .select("legacy_id, transaction_date, master_acct_code, project_code, cbs_code, cost_center, description, name, currency, amount, itbis, pay_method, document, rnc")
            .eq("is_void", false)
            .order("transaction_date", { ascending: false })
            .range(s, e)
        ),
        // 6. Full COA for ID lookup
        fetchAllPages(([s, e]: [number, number]) =>
          supabase.from("chart_of_accounts")
            .select("id, account_code, account_name")
            .is("deleted_at", null)
            .range(s, e)
        ),
      ]);

      // Build account lookup by id for journal lines
      const coaById = new Map<string, any>();
      coaAll.forEach((a: any) => coaById.set(a.id, a));

      // Build journal lookup by id
      const journalById = new Map<string, any>();
      (journalsRaw as any[]).forEach((j) => journalById.set(j.id, j));

      // Build parent_code lookup
      const parentMap = new Map<string, string>();
      (chartOfAccounts as any[]).forEach((a: any) => {
        if (a.parent_id) {
          const parent = coaById.get(a.parent_id);
          if (parent) parentMap.set(a.account_code, parent.account_code);
        }
      });

      // === Build workbook ===
      const wb = new ExcelJS.Workbook();

      // Sheet 1: ChartOfAccounts
      const s1 = wb.addWorksheet("ChartOfAccounts");
      s1.columns = [
        { header: "account_code", key: "account_code", width: 14 },
        { header: "account_name", key: "account_name", width: 30 },
        { header: "account_type", key: "account_type", width: 14 },
        { header: "currency", key: "currency", width: 8 },
        { header: "allow_posting", key: "allow_posting", width: 12 },
        { header: "parent_code", key: "parent_code", width: 14 },
        { header: "english_description", key: "english_description", width: 30 },
        { header: "spanish_description", key: "spanish_description", width: 30 },
      ];
      (chartOfAccounts as any[]).forEach((a) => {
        s1.addRow({
          ...a,
          parent_code: parentMap.get(a.account_code) || "",
        });
      });
      styleHeader(s1);

      // Sheet 2: JournalLines (denormalized)
      const s2 = wb.addWorksheet("JournalLines");
      s2.columns = [
        { header: "journal_number", key: "journal_number", width: 14 },
        { header: "journal_type", key: "journal_type", width: 10 },
        { header: "journal_date", key: "journal_date", width: 14 },
        { header: "currency", key: "currency", width: 8 },
        { header: "exchange_rate", key: "exchange_rate", width: 12 },
        { header: "posted", key: "posted", width: 8 },
        { header: "description", key: "description", width: 30 },
        { header: "account_code", key: "account_code", width: 14 },
        { header: "account_name", key: "account_name", width: 26 },
        { header: "project_code", key: "project_code", width: 12 },
        { header: "cbs_code", key: "cbs_code", width: 12 },
        { header: "debit", key: "debit", width: 14 },
        { header: "credit", key: "credit", width: 14 },
        { header: "debit_base", key: "debit_base", width: 14 },
        { header: "credit_base", key: "credit_base", width: 14 },
      ];
      (journalLinesRaw as any[]).forEach((line) => {
        const j = journalById.get(line.journal_id);
        if (!j) return;
        const acct = coaById.get(line.account_id);
        const rate = parseFloat(j.exchange_rate) || 1;
        const debit = parseFloat(line.debit) || 0;
        const credit = parseFloat(line.credit) || 0;
        const row = s2.addRow({
          journal_number: j.journal_number || "",
          journal_type: j.journal_type || "",
          journal_date: j.journal_date ? new Date(j.journal_date + "T00:00:00") : "",
          currency: j.currency || "DOP",
          exchange_rate: rate,
          posted: j.posted ? "Yes" : "No",
          description: j.description || "",
          account_code: acct?.account_code || "",
          account_name: acct?.account_name || "",
          project_code: line.project_code || "",
          cbs_code: line.cbs_code || "",
          debit,
          credit,
          debit_base: debit * rate,
          credit_base: credit * rate,
        });
        // Format date cell
        row.getCell("journal_date").numFmt = "yyyy-mm-dd";
      });
      styleHeader(s2);

      // Sheet 3: GeneralLedger
      const s3 = wb.addWorksheet("GeneralLedger");
      s3.columns = [
        { header: "journal_date", key: "journal_date", width: 14 },
        { header: "journal_number", key: "journal_number", width: 14 },
        { header: "account_code", key: "account_code", width: 14 },
        { header: "account_name", key: "account_name", width: 26 },
        { header: "description", key: "description", width: 30 },
        { header: "debit", key: "debit", width: 14 },
        { header: "credit", key: "credit", width: 14 },
        { header: "debit_base", key: "debit_base", width: 14 },
        { header: "credit_base", key: "credit_base", width: 14 },
        { header: "running_balance_base", key: "running_balance_base", width: 18 },
      ];
      (generalLedger as any[]).forEach((gl) => {
        const row = s3.addRow({
          journal_date: gl.journal_date ? new Date(gl.journal_date + "T00:00:00") : "",
          journal_number: gl.journal_number || "",
          account_code: gl.account_code || "",
          account_name: gl.account_name || "",
          description: gl.description || "",
          debit: parseFloat(gl.debit) || 0,
          credit: parseFloat(gl.credit) || 0,
          debit_base: parseFloat(gl.debit_base) || 0,
          credit_base: parseFloat(gl.credit_base) || 0,
          running_balance_base: parseFloat(gl.running_balance_base) || 0,
        });
        row.getCell("journal_date").numFmt = "yyyy-mm-dd";
      });
      styleHeader(s3);

      // Sheet 4: Transactions
      const s4 = wb.addWorksheet("Transactions");
      s4.columns = [
        { header: "legacy_id", key: "legacy_id", width: 10 },
        { header: "transaction_date", key: "transaction_date", width: 14 },
        { header: "master_acct_code", key: "master_acct_code", width: 14 },
        { header: "project_code", key: "project_code", width: 12 },
        { header: "cbs_code", key: "cbs_code", width: 12 },
        { header: "cost_center", key: "cost_center", width: 12 },
        { header: "description", key: "description", width: 30 },
        { header: "name", key: "name", width: 22 },
        { header: "currency", key: "currency", width: 8 },
        { header: "amount", key: "amount", width: 14 },
        { header: "itbis", key: "itbis", width: 12 },
        { header: "pay_method", key: "pay_method", width: 12 },
        { header: "document", key: "document", width: 16 },
        { header: "rnc", key: "rnc", width: 14 },
      ];
      (transactions as any[]).forEach((tx) => {
        const row = s4.addRow({
          legacy_id: tx.legacy_id || "",
          transaction_date: tx.transaction_date ? new Date(tx.transaction_date + "T00:00:00") : "",
          master_acct_code: tx.master_acct_code || "",
          project_code: tx.project_code || "",
          cbs_code: tx.cbs_code || "",
          cost_center: tx.cost_center || "general",
          description: tx.description || "",
          name: tx.name || "",
          currency: tx.currency || "DOP",
          amount: parseFloat(tx.amount) || 0,
          itbis: parseFloat(tx.itbis) || 0,
          pay_method: tx.pay_method || "",
          document: tx.document || "",
          rnc: tx.rnc || "",
        });
        row.getCell("transaction_date").numFmt = "yyyy-mm-dd";
      });
      styleHeader(s4);

      // Generate file
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const filename = `PowerBI_Accounting_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      const saved = await saveFileWithPicker(blob, filename);
      if (saved) {
        toast({
          title: "Exportación Exitosa",
          description: `Se exportaron ${(chartOfAccounts as any[]).length} cuentas, ${(journalLinesRaw as any[]).length} líneas de diario, ${(generalLedger as any[]).length} registros del mayor y ${(transactions as any[]).length} transacciones.`,
        });
      }
    } catch (error) {
      console.error("Power BI export error:", error);
      toast({
        title: "Error",
        description: "Error al exportar datos para Power BI.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
      Exportar Power BI
    </Button>
  );
}
