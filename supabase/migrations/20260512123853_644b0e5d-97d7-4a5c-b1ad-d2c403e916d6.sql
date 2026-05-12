
CREATE TABLE public.payroll_loan_deductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_id         UUID NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  payment_number  INTEGER NOT NULL CHECK (payment_number > 0),
  total_payments  INTEGER NOT NULL CHECK (total_payments > 0),
  loan_amount     NUMERIC(12,2) NOT NULL,
  payment_amount  NUMERIC(12,2) NOT NULL,
  entity_id       UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_loan_deductions_unique UNIQUE (period_id, employee_id, loan_id)
);

CREATE INDEX idx_payroll_loan_deductions_period ON public.payroll_loan_deductions (period_id);
CREATE INDEX idx_payroll_loan_deductions_employee ON public.payroll_loan_deductions (employee_id);
CREATE INDEX idx_payroll_loan_deductions_loan ON public.payroll_loan_deductions (loan_id);

ALTER TABLE public.payroll_loan_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_admin_payroll_loan_deductions"
  ON public.payroll_loan_deductions FOR SELECT
  USING (has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_payroll_loan_deductions"
  ON public.payroll_loan_deductions FOR SELECT
  USING (has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_payroll_loan_deductions"
  ON public.payroll_loan_deductions FOR SELECT
  USING (has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_office_payroll_loan_deductions"
  ON public.payroll_loan_deductions FOR SELECT
  USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(p_period_id uuid, p_commit boolean DEFAULT false, p_entity_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, employee_name text, salary numeric, base_pay numeric, overtime_pay numeric, holiday_pay numeric, sunday_pay numeric, total_benefits numeric, gross_pay numeric, tss numeric, isr numeric, loan_deduction numeric, absence_deduction numeric, vacation_deduction numeric, total_deductions numeric, net_pay numeric, days_worked integer, days_absent integer, days_holiday integer, overtime_hours numeric, committed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_period         RECORD;
  v_emp            RECORD;
  v_afp_emp_pct    NUMERIC;
  v_sfs_emp_pct    NUMERIC;
  v_afp_cap        NUMERIC;
  v_sfs_cap        NUMERIC;
  v_daily_rate     NUMERIC;
  v_hourly_rate    NUMERIC;
  v_days_worked    INTEGER;
  v_days_absent    INTEGER;
  v_days_holiday   INTEGER;
  v_ot_hours       NUMERIC;
  v_sunday_hours   NUMERIC;
  v_base_pay       NUMERIC;
  v_overtime_pay   NUMERIC;
  v_holiday_pay    NUMERIC;
  v_sunday_pay     NUMERIC;
  v_benefits       NUMERIC;
  v_gross_pay      NUMERIC;
  v_tss            NUMERIC;
  v_isr            NUMERIC;
  v_loan_ded       NUMERIC;
  v_absence_ded    NUMERIC;
  v_vacation_ded   NUMERIC;
  v_total_ded      NUMERIC;
  v_net_pay        NUMERIC;
  v_period_year    INTEGER;
BEGIN
  SELECT * INTO v_period FROM payroll_periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period % not found', p_period_id;
  END IF;
  IF v_period.status = 'closed' AND p_commit THEN
    RAISE EXCEPTION 'Cannot commit payroll for a closed period';
  END IF;
  IF v_period.status <> 'open' AND p_commit THEN
    RAISE EXCEPTION 'Cannot commit payroll for a % period — must be open', v_period.status;
  END IF;

  v_period_year := EXTRACT(YEAR FROM v_period.end_date)::INTEGER;

  SELECT
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'afp_employee_pct'), 2.87),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'sfs_employee_pct'), 3.04),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'afp_cap_monthly'),  420000),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'sfs_cap_monthly'),  210000)
  INTO v_afp_emp_pct, v_sfs_emp_pct, v_afp_cap, v_sfs_cap
  FROM tss_parameters
  WHERE effective_date <= v_period.end_date;

  FOR v_emp IN
    SELECT e.id, e.name, e.salary, e.entity_id
    FROM employees e
    WHERE e.is_active = true
      AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
      AND (e.date_of_hire IS NULL OR e.date_of_hire <= v_period.end_date)
      AND (e.date_of_termination IS NULL OR e.date_of_termination >= v_period.start_date)
    ORDER BY e.name
  LOOP
    v_daily_rate  := round(v_emp.salary / 23.83, 4);
    v_hourly_rate := round(v_daily_rate / 8, 4);

    SELECT
      COUNT(*) FILTER (
        WHERE NOT ts.is_absent AND NOT ts.is_holiday AND COALESCE(ts.hours_worked, 0) > 0
      )::INTEGER,
      COUNT(*) FILTER (WHERE ts.is_absent AND NOT ts.is_holiday)::INTEGER,
      COUNT(*) FILTER (
        WHERE ts.is_holiday AND NOT ts.is_absent AND COALESCE(ts.hours_worked, 0) > 0
      )::INTEGER,
      COALESCE(SUM(
        GREATEST(
          CASE
            WHEN EXTRACT(DOW FROM ts.work_date) = 6 THEN
              CASE WHEN ts.hours_worked > 5 THEN ts.hours_worked - 1 ELSE ts.hours_worked END - 4
            ELSE
              CASE WHEN ts.hours_worked > 5 THEN ts.hours_worked - 1 ELSE ts.hours_worked END - 8
          END,
          0
        )
      ) FILTER (
        WHERE NOT ts.is_holiday AND NOT ts.is_absent AND COALESCE(ts.hours_worked, 0) > 0
      ), 0),
      COALESCE(SUM(
        CASE WHEN ts.hours_worked > 5 THEN ts.hours_worked - 1 ELSE ts.hours_worked END
      ) FILTER (
        WHERE EXTRACT(DOW FROM ts.work_date) = 0 AND NOT ts.is_absent AND COALESCE(ts.hours_worked, 0) > 0
      ), 0)
    INTO v_days_worked, v_days_absent, v_days_holiday, v_ot_hours, v_sunday_hours
    FROM employee_timesheets ts
    WHERE ts.employee_id = v_emp.id AND ts.period_id = p_period_id;

    v_base_pay     := round(v_emp.salary / 2, 2);
    v_absence_ded  := round(v_days_absent * (v_emp.salary / 30), 2);
    v_overtime_pay := round(v_ot_hours * v_hourly_rate * 1.35, 2);
    v_holiday_pay  := round(v_days_holiday * v_daily_rate, 2);
    v_sunday_pay   := round(v_sunday_hours * v_hourly_rate * 0.35, 2);

    SELECT COALESCE(SUM(peb.amount), 0) INTO v_benefits
    FROM period_employee_benefits peb
    WHERE peb.period_id = p_period_id AND peb.employee_id = v_emp.id;

    IF v_benefits = 0 THEN
      SELECT COALESCE(SUM(eb.amount), 0) INTO v_benefits
      FROM employee_benefits eb
      WHERE eb.employee_id = v_emp.id AND eb.is_recurring = true AND eb.amount > 0;
    END IF;
    v_benefits := round(v_benefits, 2);

    v_gross_pay := round(v_base_pay + v_overtime_pay + v_holiday_pay + v_sunday_pay + v_benefits, 2);

    v_tss := round((
      LEAST(v_emp.salary, v_afp_cap) * v_afp_emp_pct / 100.0 +
      LEAST(v_emp.salary, v_sfs_cap) * v_sfs_emp_pct / 100.0
    ) / 2, 2);

    v_isr := round(GREATEST(
      public.calculate_annual_isr(
        GREATEST(0, (v_gross_pay - v_benefits - v_absence_ded) * 24 - v_tss * 24),
        v_period_year
      ) / 24,
      0
    ), 2);

    SELECT COALESCE(SUM(el.payment_amount), 0) INTO v_loan_ded
    FROM employee_loans el
    WHERE el.employee_id = v_emp.id AND el.is_active = true AND el.remaining_payments > 0;
    v_loan_ded := round(v_loan_ded, 2);

    v_vacation_ded := 0;
    v_total_ded := round(v_tss + v_isr + v_loan_ded + v_vacation_ded + v_absence_ded, 2);
    v_net_pay   := round(v_gross_pay - v_total_ded, 2);

    IF p_commit THEN
      INSERT INTO payroll_snapshots (
        period_id, employee_id, entity_id,
        base_pay, overtime_pay, holiday_pay, sunday_pay, total_benefits,
        tss, isr, loan_deduction, absence_deduction, vacation_deduction,
        gross_pay, net_pay
      ) VALUES (
        p_period_id, v_emp.id, v_emp.entity_id,
        v_base_pay, v_overtime_pay, v_holiday_pay, v_sunday_pay, v_benefits,
        v_tss, v_isr, v_loan_ded,
        v_absence_ded, v_vacation_ded,
        v_gross_pay, v_net_pay
      )
      ON CONFLICT (period_id, employee_id) DO UPDATE SET
        base_pay           = EXCLUDED.base_pay,
        overtime_pay       = EXCLUDED.overtime_pay,
        holiday_pay        = EXCLUDED.holiday_pay,
        sunday_pay         = EXCLUDED.sunday_pay,
        total_benefits     = EXCLUDED.total_benefits,
        tss                = EXCLUDED.tss,
        isr                = EXCLUDED.isr,
        loan_deduction     = EXCLUDED.loan_deduction,
        absence_deduction  = EXCLUDED.absence_deduction,
        vacation_deduction = EXCLUDED.vacation_deduction,
        gross_pay          = EXCLUDED.gross_pay,
        net_pay            = EXCLUDED.net_pay;

      INSERT INTO public.payroll_loan_deductions (
        period_id, employee_id, loan_id, payment_number, total_payments,
        loan_amount, payment_amount, entity_id
      )
      SELECT
        p_period_id,
        v_emp.id,
        el.id,
        el.number_of_payments - el.remaining_payments + 1,
        el.number_of_payments,
        el.loan_amount,
        el.payment_amount,
        v_emp.entity_id
      FROM employee_loans el
      WHERE el.employee_id = v_emp.id
        AND el.is_active = true
        AND el.remaining_payments > 0
      ON CONFLICT (period_id, employee_id, loan_id) DO NOTHING;

      UPDATE employee_loans
      SET remaining_payments = remaining_payments - 1,
          is_active = (remaining_payments - 1 > 0),
          updated_at = now()
      WHERE employee_loans.employee_id = v_emp.id
        AND employee_loans.is_active = true
        AND employee_loans.remaining_payments > 0;
    END IF;

    employee_id        := v_emp.id;
    employee_name      := v_emp.name;
    salary             := v_emp.salary;
    base_pay           := v_base_pay;
    overtime_pay       := v_overtime_pay;
    holiday_pay        := v_holiday_pay;
    sunday_pay         := v_sunday_pay;
    total_benefits     := v_benefits;
    gross_pay          := v_gross_pay;
    tss                := v_tss;
    isr                := v_isr;
    loan_deduction     := v_loan_ded;
    absence_deduction  := v_absence_ded;
    vacation_deduction := v_vacation_ded;
    total_deductions   := v_total_ded;
    net_pay            := v_net_pay;
    days_worked        := v_days_worked;
    days_absent        := v_days_absent;
    days_holiday       := v_days_holiday;
    overtime_hours     := v_ot_hours;
    committed          := p_commit;
    RETURN NEXT;
  END LOOP;
END;
$function$;

WITH ordered AS (
  SELECT
    ps.period_id,
    ps.employee_id,
    el.id AS loan_id,
    el.number_of_payments,
    el.remaining_payments,
    el.loan_amount,
    el.payment_amount,
    ps.entity_id,
    ROW_NUMBER() OVER (
      PARTITION BY ps.employee_id, el.id
      ORDER BY pp.start_date ASC, pp.end_date ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY ps.employee_id, el.id) AS total_periods
  FROM public.payroll_snapshots ps
  JOIN public.payroll_periods pp ON pp.id = ps.period_id
  JOIN public.employee_loans  el ON el.employee_id = ps.employee_id
  WHERE ps.loan_deduction > 0
    AND pp.status = 'closed'
    AND pp.end_date >= el.loan_date
)
INSERT INTO public.payroll_loan_deductions (
  period_id, employee_id, loan_id, payment_number, total_payments,
  loan_amount, payment_amount, entity_id
)
SELECT
  o.period_id,
  o.employee_id,
  o.loan_id,
  GREATEST(1, (o.number_of_payments - o.remaining_payments) - (o.total_periods - o.rn)),
  o.number_of_payments,
  o.loan_amount,
  o.payment_amount,
  o.entity_id
FROM ordered o
ON CONFLICT (period_id, employee_id, loan_id) DO NOTHING;
