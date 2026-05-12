SELECT COUNT(*) AS mismatched_service_payment_transactions
FROM public.service_entry_payments sep
JOIN public.service_entries se ON se.id = sep.service_entry_id
JOIN public.transactions t ON t.id = sep.transaction_id
WHERE NULLIF(TRIM(se.master_acct_code), '') IS NOT NULL
  AND t.master_acct_code IS DISTINCT FROM se.master_acct_code;