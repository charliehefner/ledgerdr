import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

type UnlinkedTransaction = {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  itbis: number | null;
  master_acct_code: string | null;
  pay_method: string | null;
  cost_center: string | null;
  transaction_direction: string | null;
  destination_acct_code: string | null;
};

type PayMethodMapping = {
  pay_method: string;
  account_id: string;
};

type AccountLookup = {
  id: string;
  account_code: string;
};

export function useJournalGeneration(userId?: string) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  async function countUnlinked(): Promise<number> {
    // Get transaction IDs that already have journals
    const { data: linked } = await supabase
      .from("journals")
      .select("transaction_source_id")
      .not("transaction_source_id", "is", null)
      .is("deleted_at", null);

    const linkedIds = new Set((linked || []).map((j) => j.transaction_source_id));

    const { data: txns, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("is_void", false);

    if (error) throw error;
    return (txns || []).filter((t) => !linkedIds.has(t.id)).length;
  }

  async function generate(): Promise<number> {
    setGenerating(true);
    setProgress({ current: 0, total: 0 });

    try {
      // 1. Fetch payment method mappings
      const { data: mappings, error: mErr } = await supabase
        .from("payment_method_accounts")
        .select("pay_method, account_id");
      if (mErr) throw mErr;

      const mappingMap = new Map<string, string>(
        (mappings as PayMethodMapping[]).map((m) => [m.pay_method, m.account_id])
      );

      // 2. Fetch chart of accounts for code→id lookups
      const { data: accounts, error: aErr } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code")
        .eq("allow_posting", true)
        .is("deleted_at", null);
      if (aErr) throw aErr;

      const acctByCode = new Map<string, string>(
        (accounts as AccountLookup[]).map((a) => [a.account_code, a.id])
      );

      const itbisAccountId = acctByCode.get("1650");

      // 3. Get already-linked transaction IDs
      const { data: linked } = await supabase
        .from("journals")
        .select("transaction_source_id")
        .not("transaction_source_id", "is", null)
        .is("deleted_at", null);

      const linkedIds = new Set((linked || []).map((j) => j.transaction_source_id));

      // 4. Fetch unlinked transactions
      const { data: txns, error: tErr } = await supabase
        .from("transactions")
        .select("id, transaction_date, description, amount, itbis, master_acct_code, pay_method, cost_center, transaction_direction, destination_acct_code")
        .eq("is_void", false)
        .order("transaction_date", { ascending: true });
      if (tErr) throw tErr;

      const unlinked = (txns || []).filter((t) => !linkedIds.has(t.id)) as UnlinkedTransaction[];

      if (unlinked.length === 0) {
        toast({ title: "Info", description: "No hay transacciones sin asiento." });
        return 0;
      }

      setProgress({ current: 0, total: unlinked.length });

      let created = 0;
      const skipped: string[] = [];

      for (const txn of unlinked) {
        const isInvestment = txn.transaction_direction === 'investment';

        if (isInvestment) {
          // Investment: Debit destination account, Credit master account (intercompany/equity)
          const creditAccountId = txn.master_acct_code ? acctByCode.get(txn.master_acct_code) : null;
          const debitAccountId = txn.destination_acct_code ? acctByCode.get(txn.destination_acct_code) : null;

          if (!creditAccountId) {
            skipped.push(`${txn.description || txn.id}: cuenta crédito "${txn.master_acct_code}" no encontrada`);
            setProgress((p) => ({ ...p, current: p.current + 1 }));
            continue;
          }
          if (!debitAccountId) {
            skipped.push(`${txn.description || txn.id}: cuenta destino "${txn.destination_acct_code}" no encontrada`);
            setProgress((p) => ({ ...p, current: p.current + 1 }));
            continue;
          }

          const { data: journalId, error: jErr } = await supabase.rpc(
            "create_journal_from_transaction",
            {
              p_transaction_id: txn.id,
              p_date: txn.transaction_date,
              p_description: `${txn.description || "Inversión"}${txn.cost_center && txn.cost_center !== 'general' ? ` [${txn.cost_center === 'agricultural' ? 'Agrícola' : 'Industrial'}]` : ''}`,
              p_created_by: userId || null,
            }
          );
          if (jErr) {
            skipped.push(`${txn.description || txn.id}: ${jErr.message}`);
            setProgress((p) => ({ ...p, current: p.current + 1 }));
            continue;
          }

          const itbisAmount = txn.itbis || 0;
          const netAmount = txn.amount - itbisAmount;
          const lines: { journal_id: string; account_id: string; debit: number; credit: number; created_by: string | undefined }[] = [];

          // Debit: destination account (bank or fixed asset) - net amount
          lines.push({ journal_id: journalId, account_id: debitAccountId, debit: netAmount, credit: 0, created_by: userId });

          // Debit: ITBIS (if applicable)
          if (itbisAmount > 0 && itbisAccountId) {
            lines.push({ journal_id: journalId, account_id: itbisAccountId, debit: itbisAmount, credit: 0, created_by: userId });
          }

          // Credit: master account (intercompany/equity) - full amount
          lines.push({ journal_id: journalId, account_id: creditAccountId, debit: 0, credit: txn.amount, created_by: userId });

          const { error: lErr } = await supabase.from("journal_lines").insert(lines);
          if (lErr) {
            skipped.push(`${txn.description || txn.id}: líneas: ${lErr.message}`);
          } else {
            created++;
          }
          setProgress((p) => ({ ...p, current: p.current + 1 }));
          continue;
        }

        // Standard purchase/sale logic
        const expenseAccountId = txn.master_acct_code ? acctByCode.get(txn.master_acct_code) : null;
        const payAccountId = txn.pay_method ? mappingMap.get(txn.pay_method) : null;

        if (!expenseAccountId) {
          skipped.push(`${txn.description || txn.id}: cuenta gasto "${txn.master_acct_code}" no encontrada`);
          setProgress((p) => ({ ...p, current: p.current + 1 }));
          continue;
        }
        if (!payAccountId) {
          skipped.push(`${txn.description || txn.id}: método pago "${txn.pay_method}" sin mapeo`);
          setProgress((p) => ({ ...p, current: p.current + 1 }));
          continue;
        }

        // Create journal via DB function
        const { data: journalId, error: jErr } = await supabase.rpc(
          "create_journal_from_transaction",
          {
            p_transaction_id: txn.id,
            p_date: txn.transaction_date,
            p_description: `${txn.description || "Transacción"}${txn.cost_center && txn.cost_center !== 'general' ? ` [${txn.cost_center === 'agricultural' ? 'Agrícola' : 'Industrial'}]` : ''}`,
            p_created_by: userId || null,
          }
        );
        if (jErr) {
          skipped.push(`${txn.description || txn.id}: ${jErr.message}`);
          setProgress((p) => ({ ...p, current: p.current + 1 }));
          continue;
        }

        // Build journal lines
        const itbisAmount = txn.itbis || 0;
        const netAmount = txn.amount - itbisAmount;
        const lines: {
          journal_id: string;
          account_id: string;
          debit: number;
          credit: number;
          created_by: string | undefined;
        }[] = [];

        // Debit: expense account (net amount)
        lines.push({
          journal_id: journalId,
          account_id: expenseAccountId,
          debit: netAmount,
          credit: 0,
          created_by: userId,
        });

        // Debit: ITBIS (if applicable)
        if (itbisAmount > 0 && itbisAccountId) {
          lines.push({
            journal_id: journalId,
            account_id: itbisAccountId,
            debit: itbisAmount,
            credit: 0,
            created_by: userId,
          });
        }

        // Credit: payment account (full amount)
        lines.push({
          journal_id: journalId,
          account_id: payAccountId,
          debit: 0,
          credit: txn.amount,
          created_by: userId,
        });

        const { error: lErr } = await supabase.from("journal_lines").insert(lines);
        if (lErr) {
          skipped.push(`${txn.description || txn.id}: líneas: ${lErr.message}`);
        } else {
          created++;
        }

        setProgress((p) => ({ ...p, current: p.current + 1 }));
      }

      queryClient.invalidateQueries({ queryKey: ["journals"] });

      if (skipped.length > 0) {
        toast({
          title: `${created} asientos creados, ${skipped.length} omitidos`,
          description: skipped.slice(0, 3).join("\n"),
          variant: skipped.length > 0 ? "destructive" : "default",
        });
      } else {
        toast({ title: "Completado", description: `${created} asientos creados como borradores.` });
      }

      return created;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return 0;
    } finally {
      setGenerating(false);
    }
  }

  return { generate, countUnlinked, generating, progress };
}
