
DO $$
DECLARE max_id bigint;
BEGIN
  SELECT COALESCE(MAX(legacy_id), 0) INTO max_id FROM transactions;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS transactions_legacy_id_seq START WITH %s', max_id + 1);
END$$;

ALTER TABLE transactions
  ALTER COLUMN legacy_id SET DEFAULT nextval('transactions_legacy_id_seq');
