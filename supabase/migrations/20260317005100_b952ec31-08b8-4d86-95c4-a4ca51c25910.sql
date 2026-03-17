
INSERT INTO ap_ar_documents (
  contact_name, contact_rnc, direction, document_date, due_date,
  total_amount, amount_paid, status, currency,
  linked_transaction_ids, account_id, document_type
)
SELECT
  COALESCE(t.name, 'Sin nombre'),
  t.rnc,
  CASE WHEN t.transaction_direction = 'sale' THEN 'receivable' ELSE 'payable' END,
  t.transaction_date,
  COALESCE(t.due_date, (t.transaction_date + interval '30 days')::date),
  t.amount,
  0,
  'open',
  COALESCE(t.currency, 'DOP'),
  ARRAY[t.id],
  (SELECT id FROM chart_of_accounts
   WHERE deleted_at IS NULL AND allow_posting = true
     AND account_code LIKE CASE WHEN t.transaction_direction = 'sale' THEN '12%' ELSE '21%' END
   ORDER BY account_code LIMIT 1),
  CASE WHEN t.transaction_direction = 'sale' THEN 'invoice' ELSE 'bill' END
FROM transactions t
WHERE t.pay_method = 'credit'
  AND t.is_void = false
  AND NOT EXISTS (
    SELECT 1 FROM ap_ar_documents d
    WHERE d.linked_transaction_ids @> ARRAY[t.id]::uuid[]
  );
