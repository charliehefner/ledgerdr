ALTER TABLE journals ADD COLUMN is_reconciled boolean DEFAULT false;
ALTER TABLE journals ADD COLUMN reference_description text;