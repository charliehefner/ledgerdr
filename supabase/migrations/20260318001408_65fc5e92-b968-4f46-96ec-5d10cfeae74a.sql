-- Create individual bank GL accounts under 1930 parent
INSERT INTO chart_of_accounts (account_code, account_name, account_type, allow_posting, english_description, spanish_description, parent_id)
VALUES
  ('1931', 'BDI DOP 4010176533', 'ASSET', true, 'BDI DOP checking account', 'Cuenta corriente BDI DOP', (SELECT id FROM chart_of_accounts WHERE account_code = '1930' AND deleted_at IS NULL)),
  ('1932', 'BDI USD 4010176526', 'ASSET', true, 'BDI USD checking account', 'Cuenta corriente BDI USD', (SELECT id FROM chart_of_accounts WHERE account_code = '1930' AND deleted_at IS NULL)),
  ('1933', 'BDI EUR 4010176501', 'ASSET', true, 'BDI EUR checking account', 'Cuenta corriente BDI EUR', (SELECT id FROM chart_of_accounts WHERE account_code = '1930' AND deleted_at IS NULL)),
  ('1934', 'BHD DOP 36900090011', 'ASSET', true, 'BHD DOP checking account', 'Cuenta corriente BHD DOP', (SELECT id FROM chart_of_accounts WHERE account_code = '1930' AND deleted_at IS NULL)),
  ('1935', 'BHD USD 36900090020', 'ASSET', true, 'BHD USD checking account', 'Cuenta corriente BHD USD', (SELECT id FROM chart_of_accounts WHERE account_code = '1930' AND deleted_at IS NULL)),
  ('1936', 'Premium BDI USD 4010176526', 'ASSET', true, 'BDI Premium USD account', 'Cuenta Premium BDI USD', (SELECT id FROM chart_of_accounts WHERE account_code = '1930' AND deleted_at IS NULL));

-- Make 1930 a non-posting header
UPDATE chart_of_accounts SET allow_posting = false, account_name = 'Cuentas Bancarias' WHERE account_code = '1930' AND deleted_at IS NULL;

-- Create credit card liability accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, allow_posting, english_description, spanish_description)
VALUES
  ('2850', 'Tarjetas de Crédito', 'LIABILITY', false, 'Credit Cards (header)', 'Tarjetas de crédito (encabezado)');

INSERT INTO chart_of_accounts (account_code, account_name, account_type, allow_posting, english_description, spanish_description, parent_id)
VALUES
  ('2851', 'TC BDI Agri', 'LIABILITY', true, 'Credit Card - Agriculture', 'Tarjeta de crédito - Agricultura', (SELECT id FROM chart_of_accounts WHERE account_code = '2850' AND deleted_at IS NULL)),
  ('2852', 'TC BDI Industry', 'LIABILITY', true, 'Credit Card - Industry', 'Tarjeta de crédito - Industria', (SELECT id FROM chart_of_accounts WHERE account_code = '2850' AND deleted_at IS NULL)),
  ('2853', 'TC BDI Management', 'LIABILITY', true, 'Credit Card - Management', 'Tarjeta de crédito - Gerencia', (SELECT id FROM chart_of_accounts WHERE account_code = '2850' AND deleted_at IS NULL));