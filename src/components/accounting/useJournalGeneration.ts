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
  destination_amount: number | null;
  currency: string | null;
};

type PayMethodMapping = {
  pay_method: string;
  account_id: string;
};

type AccountLookup = {
  id: string;
  account_code: string;
};

type BankAccountLookup = {
  id: string;
  chart_account_id: string | null;
  currency: string | null;
};

export function useJournalGeneration(userId?: string) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  async function countUnlinked(): Promise<number> {
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
      const fxAccountId = acctByCode.get("8510");

      // 3. Fetch bank accounts for transfer lookups (id → chart_account_id)
      const { data: bankAccts, error: bErr } = await supabase
        .from("bank_accounts")
        .select("id, chart_account_id, currency");
      if (bErr) throw bErr;

      const bankAccountMap = new Map<string, BankAccountLookup>(
        (bankAccts || []).map((b) => [b.id, b as BankAccountLookup])
      );

      // 4. Get already-linked transaction IDs
      const { data: linked } = await supabase
        .from("journals")
        .select("transaction_source_id")
        .not("transaction_source_id", "is", null)
        .is("deleted_at", null);

      const linkedIds = new Set((linked || []).map((j) => j.transaction_source_id));

      // 5. Fetch unlinked transactions
      const { data: txns, error: tErr } = await supabase
        .from("transactions")
        .select("id, transaction_date, description, amount, itbis, master_acct_code, pay_method, cost_center, transaction_direction, destination_acct_code, destination_amount, currency")
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
        const isTransfer = txn.transaction_direction === 'payment';

        if (isInvestment) {
          // Investment: Debit destination account, Credit master account
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
              p_journal_type: 'PJ',
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

          lines.push({ journal_id: journalId, account_id: debitAccountId, debit: netAmount, credit: 0, created_by: userId });
          if (itbisAmount > 0 && itbisAccountId) {
            lines.push({ journal_id: journalId, account_id: itbisAccountId, debit: itbisAmount, credit: 0, created_by: userId });
          }
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

        if (isTransfer) {
          // Transfer: Debit destination account, Credit source account
          // pay_method holds the source bank_accounts.id
          // destination_acct_code holds the destination bank_accounts.id or chart_of_accounts code (prefixed coa:)

          // Resolve source (credit) account from bank_accounts
          const sourceBankAcct = txn.pay_method ? bankAccountMap.get(txn.pay_method) : null;
          const sourceChartAccountId = sourceBankAcct?.chart_account_id || null;

          if (!sourceChartAccountId) {
            skipped.push(`${txn.description || txn.id}: cuenta origen sin mapeo contable`);
            setProgress((p) => ({ ...p, current: p.current + 1 }));
            continue;
          }

          // Resolve destination (debit) account
          let destChartAccountId: string | null = null;
          if (txn.destination_acct_code) {
            // Check if it's a bank_accounts.id
            const destBankAcct = bankAccountMap.get(txn.destination_acct_code);
            if (destBankAcct?.chart_account_id) {
              destChartAccountId = destBankAcct.chart_account_id;
            } else {
              // It's a chart_of_accounts code directly
              destChartAccountId = acctByCode.get(txn.destination_acct_code) || null;
            }
          }

          if (!destChartAccountId) {
            skipped.push(`${txn.description || txn.id}: cuenta destino sin mapeo contable`);
            setProgress((p) => ({ ...p, current: p.current + 1 }));
            continue;
          }

          const { data: journalId, error: jErr } = await supabase.rpc(
            "create_journal_from_transaction",
            {
              p_transaction_id: txn.id,
              p_date: txn.transaction_date,
              p_description: `${txn.description || "Transferencia"}${txn.cost_center && txn.cost_center !== 'general' ? ` [${txn.cost_center === 'agricultural' ? 'Agrícola' : 'Industrial'}]` : ''}`,
              p_created_by: userId || null,
              p_journal_type: 'CDJ',
            }
          );
          if (jErr) {
            skipped.push(`${txn.description || txn.id}: ${jErr.message}`);
            setProgress((p) => ({ ...p, current: p.current + 1 }));
            continue;
          }

          const lines: { journal_id: string; account_id: string; debit: number; credit: number; created_by: string | undefined }[] = [];

          const sourceAmount = txn.amount; // What leaves the source account
          const destAmount = txn.destination_amount || txn.amount; // What arrives at the destination

          // For cross-currency transfers, both amounts are already in their respective currencies.
          // The journal should balance in base currency (DOP).
          // If source is USD and dest is DOP, the dest amount IS the base amount.
          // If source is DOP and dest is USD, the source amount IS the base amount.
          const sourceCurrency = txn.currency || 'DOP';
          const destBankAcct = txn.destination_acct_code ? bankAccountMap.get(txn.destination_acct_code) : null;
          const destCurrency = destBankAcct?.currency || 'DOP';

          // For same-currency transfers, debit and credit are equal
          // For cross-currency, we use the DOP side as the balancing amount
          if (sourceCurrency === destCurrency || !txn.destination_amount) {
            // Same currency or no separate destination amount: simple debit/credit
            lines.push({ journal_id: journalId, account_id: destChartAccountId, debit: sourceAmount, credit: 0, created_by: userId });
            lines.push({ journal_id: journalId, account_id: sourceChartAccountId, debit: 0, credit: sourceAmount, created_by: userId });
          } else {
            // Cross-currency: one side is DOP, use that as the journal balance base
            // Determine which side is DOP for balancing
            let debitAmount: number;
            let creditAmount: number;

            if (destCurrency === 'DOP') {
              // Source is foreign, dest is DOP — use dest amount as the base
              debitAmount = destAmount; // DOP amount going into destination
              creditAmount = destAmount; // Must balance
            } else if (sourceCurrency === 'DOP') {
              // Source is DOP, dest is foreign — use source amount as the base
              debitAmount = sourceAmount;
              creditAmount = sourceAmount;
            } else {
              // Both foreign (unusual) — use source amount as base
              debitAmount = sourceAmount;
              creditAmount = sourceAmount;
            }

            lines.push({ journal_id: journalId, account_id: destChartAccountId, debit: debitAmount, credit: 0, created_by: userId });
            lines.push({ journal_id: journalId, account_id: sourceChartAccountId, debit: 0, credit: creditAmount, created_by: userId });
          }



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

        const journalType = txn.transaction_direction === 'sale' ? 'SJ' : 'PJ';
        const { data: journalId, error: jErr } = await supabase.rpc(
          "create_journal_from_transaction",
          {
            p_transaction_id: txn.id,
            p_date: txn.transaction_date,
            p_description: `${txn.description || "Transacción"}${txn.cost_center && txn.cost_center !== 'general' ? ` [${txn.cost_center === 'agricultural' ? 'Agrícola' : 'Industrial'}]` : ''}`,
            p_created_by: userId || null,
            p_journal_type: journalType,
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

        lines.push({ journal_id: journalId, account_id: expenseAccountId, debit: netAmount, credit: 0, created_by: userId });
        if (itbisAmount > 0 && itbisAccountId) {
          lines.push({ journal_id: journalId, account_id: itbisAccountId, debit: itbisAmount, credit: 0, created_by: userId });
        }
        lines.push({ journal_id: journalId, account_id: payAccountId, debit: 0, credit: txn.amount, created_by: userId });

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
