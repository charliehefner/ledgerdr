import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type DepreciationResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export function useDepreciationGeneration() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const generate = async (
    periodYear: number,
    periodMonth: number,
    frequency: "monthly" | "quarterly"
  ): Promise<DepreciationResult> => {
    setGenerating(true);
    setProgress(0);

    const result: DepreciationResult = { created: 0, skipped: 0, errors: [] };

    try {
      // Period date is the last day of the selected month
      const periodDate = new Date(periodYear, periodMonth, 0)
        .toISOString()
        .slice(0, 10);

      // Fetch eligible assets
      const { data: assets, error: aErr } = await supabase
        .from("fixed_assets")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .not("in_service_date", "is", null)
        .not("depreciation_expense_account", "is", null)
        .not("accumulated_depreciation_account", "is", null)
        .gt("useful_life_years", 0);

      if (aErr) throw aErr;
      if (!assets || assets.length === 0) {
        toast({ title: "Sin activos", description: "No hay activos elegibles para depreciar." });
        return result;
      }

      // Filter: remaining book value > 0 and in_service_date <= period end
      const eligible = assets.filter((a) => {
        const netBook = Number(a.acquisition_value) - Number(a.accumulated_depreciation);
        return netBook > 0 && a.in_service_date && a.in_service_date <= periodDate;
      });

      if (eligible.length === 0) {
        toast({ title: "Sin activos", description: "Todos los activos ya están totalmente depreciados o no están en servicio." });
        return result;
      }

      // Check existing depreciation_schedule entries for this period
      const { data: existing } = await supabase
        .from("depreciation_schedule")
        .select("asset_id")
        .eq("period_date", periodDate);

      const alreadyProcessed = new Set((existing || []).map((e) => e.asset_id));

      // Resolve account IDs from chart_of_accounts
      const accountCodes = new Set<string>();
      eligible.forEach((a) => {
        if (a.depreciation_expense_account) accountCodes.add(a.depreciation_expense_account);
        if (a.accumulated_depreciation_account) accountCodes.add(a.accumulated_depreciation_account);
      });

      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code")
        .in("account_code", Array.from(accountCodes))
        .is("deleted_at", null);

      const accountMap = new Map((accounts || []).map((a) => [a.account_code, a.id]));

      const toProcess = eligible.filter((a) => !alreadyProcessed.has(a.id));
      result.skipped = eligible.length - toProcess.length;
      setTotal(toProcess.length);

      for (let i = 0; i < toProcess.length; i++) {
        const asset = toProcess[i];
        setProgress(i + 1);

        try {
          const monthlyAmount =
            (Number(asset.acquisition_value) - Number(asset.salvage_value)) /
            (Number(asset.useful_life_years) * 12);

          let amount = frequency === "quarterly" ? monthlyAmount * 3 : monthlyAmount;

          // Cap at remaining book value
          const remaining = Number(asset.acquisition_value) - Number(asset.accumulated_depreciation);
          if (amount > remaining) amount = remaining;

          amount = Math.round(amount * 100) / 100;
          if (amount <= 0) {
            result.skipped++;
            continue;
          }

          const expenseAccountId = accountMap.get(asset.depreciation_expense_account!);
          const accumAccountId = accountMap.get(asset.accumulated_depreciation_account!);

          if (!expenseAccountId || !accumAccountId) {
            result.errors.push(`${asset.asset_code}: Cuenta no encontrada`);
            continue;
          }

          // Create journal
          const { data: journal, error: jErr } = await supabase
            .from("journals")
            .insert({
              journal_date: periodDate,
              description: `Depreciación ${frequency === "quarterly" ? "trimestral" : "mensual"} – ${asset.name} (${asset.asset_code})`,
              currency: "DOP",
              created_by: user?.id,
              posted: false,
              journal_type: "DEP",
            } as any)
            .select("id")
            .single();

          if (jErr) throw jErr;

          // Insert journal lines
          const { error: lErr } = await supabase.from("journal_lines").insert([
            {
              journal_id: journal.id,
              account_id: expenseAccountId,
              debit: amount,
              credit: 0,
              created_by: user?.id,
            },
            {
              journal_id: journal.id,
              account_id: accumAccountId,
              debit: 0,
              credit: amount,
              created_by: user?.id,
            },
          ]);
          if (lErr) throw lErr;

          // Insert depreciation_schedule record
          const { error: dsErr } = await supabase.from("depreciation_schedule").insert({
            asset_id: asset.id,
            period_date: periodDate,
            depreciation_amount: amount,
            journal_id: journal.id,
          });
          if (dsErr) throw dsErr;

          // Update accumulated_depreciation on asset
          const { error: uErr } = await supabase
            .from("fixed_assets")
            .update({
              accumulated_depreciation: Number(asset.accumulated_depreciation) + amount,
            })
            .eq("id", asset.id);
          if (uErr) throw uErr;

          result.created++;
        } catch (err: any) {
          result.errors.push(`${asset.asset_code}: ${err.message}`);
        }
      }

      return result;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return result;
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generating, progress, total };
}
