UPDATE public.transactions t
SET master_acct_code = se.master_acct_code,
    account_id = coa.id
FROM public.service_entry_payments sep
JOIN public.service_entries se ON se.id = sep.service_entry_id
JOIN public.chart_of_accounts coa
  ON coa.account_code = se.master_acct_code
 AND coa.allow_posting = true
 AND coa.deleted_at IS NULL
WHERE t.id = sep.transaction_id
  AND NULLIF(TRIM(se.master_acct_code), '') IS NOT NULL
  AND (t.master_acct_code IS DISTINCT FROM se.master_acct_code OR t.account_id IS DISTINCT FROM coa.id);