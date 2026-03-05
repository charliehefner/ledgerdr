INSERT INTO chart_of_accounts (account_code, account_name, account_type, allow_posting, english_description, spanish_description)
SELECT '2160', 'JORD AB - Casa Matriz', 'LIABILITY', true, 'JORD AB - Head Office (Intercompany)', 'JORD AB - Casa Matriz (Intercompañía)'
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts WHERE account_code = '2160' AND deleted_at IS NULL
);