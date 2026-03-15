
-- 1. Fix trial_balance: COALESCE exchange_rate to 1
CREATE OR REPLACE FUNCTION public.trial_balance(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
 RETURNS TABLE(account_code character varying, account_name text, account_type text, total_debit_base numeric, total_credit_base numeric, balance_base numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(l.debit * COALESCE(j.exchange_rate, 1))  AS total_debit_base,
    SUM(l.credit * COALESCE(j.exchange_rate, 1)) AS total_credit_base,
    SUM((l.debit - l.credit) * COALESCE(j.exchange_rate, 1)) AS balance_base
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id
  JOIN journals j ON j.id = l.journal_id AND j.posted = true
  WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
    AND (p_start IS NULL OR j.journal_date >= p_start)
    AND (p_end   IS NULL OR j.journal_date <= p_end)
  GROUP BY a.account_code, a.account_name, a.account_type
  ORDER BY a.account_code;
$function$;

-- 2. Fix income_statement: COALESCE exchange_rate to 1
CREATE OR REPLACE FUNCTION public.income_statement(p_start date, p_end date)
 RETURNS TABLE(account_type text, total_income numeric, total_expense numeric, net_result numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    a.account_type,
    SUM(CASE WHEN a.account_type = 'INCOME'  THEN (l.credit - l.debit) * COALESCE(j.exchange_rate, 1) ELSE 0 END) AS total_income,
    SUM(CASE WHEN a.account_type = 'EXPENSE' THEN (l.debit - l.credit) * COALESCE(j.exchange_rate, 1) ELSE 0 END) AS total_expense,
    SUM(CASE WHEN a.account_type IN ('INCOME','EXPENSE') THEN (l.credit - l.debit) * COALESCE(j.exchange_rate, 1) ELSE 0 END) AS net_result
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
  WHERE j.journal_date BETWEEN p_start AND p_end
    AND a.account_type IN ('INCOME','EXPENSE')
    AND l.deleted_at IS NULL
  GROUP BY a.account_type;
$function$;

-- 3. Fix income_statement_detail: COALESCE exchange_rate to 1
CREATE OR REPLACE FUNCTION public.income_statement_detail(p_start date, p_end date)
 RETURNS TABLE(account_code character varying, account_name text, account_type text, total_amount numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(
      CASE
        WHEN a.account_type = 'INCOME'  THEN (l.credit - l.debit) * COALESCE(j.exchange_rate, 1)
        WHEN a.account_type = 'EXPENSE' THEN (l.debit - l.credit) * COALESCE(j.exchange_rate, 1)
        ELSE 0
      END
    ) AS total_amount
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
  WHERE j.journal_date BETWEEN p_start AND p_end
    AND a.account_type IN ('INCOME','EXPENSE')
    AND l.deleted_at IS NULL
  GROUP BY a.account_code, a.account_name, a.account_type
  ORDER BY a.account_type, a.account_code;
$function$;

-- 4. Create tss_parameters table for externalizing TSS rates
CREATE TABLE IF NOT EXISTS public.tss_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key text UNIQUE NOT NULL,
  parameter_value numeric NOT NULL,
  description text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tss_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tss_parameters"
ON public.tss_parameters FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage tss_parameters"
ON public.tss_parameters FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Create auto-mapping function for dgii_tipo_bienes_servicios
CREATE OR REPLACE FUNCTION public.auto_set_dgii_tipo_bienes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only auto-set for purchases when not already set
  IF NEW.transaction_direction = 'purchase' 
     AND (NEW.dgii_tipo_bienes_servicios IS NULL OR NEW.dgii_tipo_bienes_servicios = '') 
     AND NEW.master_acct_code IS NOT NULL THEN
    
    NEW.dgii_tipo_bienes_servicios := CASE
      WHEN NEW.master_acct_code LIKE '70%' OR NEW.master_acct_code LIKE '71%' THEN '01' -- Personal
      WHEN NEW.master_acct_code LIKE '72%' OR NEW.master_acct_code LIKE '73%' THEN '02' -- Trabajos/Suministros/Servicios
      WHEN NEW.master_acct_code LIKE '74%' THEN '03' -- Arrendamientos
      WHEN NEW.master_acct_code LIKE '12%' OR NEW.master_acct_code LIKE '13%' THEN '10' -- Adquisiciones de Activos
      WHEN NEW.master_acct_code LIKE '75%' THEN '11' -- Seguros
      WHEN NEW.master_acct_code LIKE '76%' THEN '02' -- Suministros/Servicios
      WHEN NEW.master_acct_code LIKE '80%' OR NEW.master_acct_code LIKE '81%' THEN '07' -- Gastos Financieros
      WHEN NEW.master_acct_code LIKE '40%' OR NEW.master_acct_code LIKE '41%' 
           OR NEW.master_acct_code LIKE '42%' OR NEW.master_acct_code LIKE '43%' THEN '09' -- Costo de Venta
      ELSE NULL
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_dgii_tipo_bienes
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_dgii_tipo_bienes();
