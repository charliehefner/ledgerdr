
INSERT INTO chart_of_accounts (account_code, account_name, account_type, allow_posting, parent_id, spanish_description, english_description)
VALUES
  ('1911', 'Caja Chica Finca', 'ASSET', true, 'd5bef21f-c229-4ba1-9288-1fe8f55e7791', 'Caja chica para operaciones de finca', 'Farm petty cash fund'),
  ('1912', 'Caja Chica Industria', 'ASSET', true, 'd5bef21f-c229-4ba1-9288-1fe8f55e7791', 'Caja chica para reembolsos de industria', 'Industry petty cash (reimbursement)');

UPDATE chart_of_accounts SET allow_posting = false WHERE account_code = '1910';
