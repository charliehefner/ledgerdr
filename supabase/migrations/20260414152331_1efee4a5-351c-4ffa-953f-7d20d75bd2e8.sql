
-- Drop both existing overloads
DROP FUNCTION IF EXISTS public.calculate_payroll_for_period(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.calculate_payroll_for_period(UUID, BOOLEAN, UUID);

-- Create single unified function
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(
  p_period_id   UUID,
  p_commit      BOOLEAN DEFAULT FALSE,
  p_entity_id   UUID    DEFAULT NULL
)
RETURNS TABLE (
  employee_id        UUID,
  employee_name      TEXT,
  salary             NUMERIC,
  base_pay           NUMERIC,
  overtime_pay       NUMERIC,
  holiday_pay        NUMERIC,
  sunday_pay         NUMERIC,
  total_benefits     NUMERIC,
  gross_pay          NUMERIC,
  tss                NUMERIC,
  isr                NUMERIC,
  loan_deduction     NUMERIC,
  absence_deduction  NUMERIC,
  vacation_deduction NUMERIC,
  total_deductions   NUMERIC,
  net_pay            NUMERIC,
  days_worked        INTEGER,
  days_absent        INTEGER,
  days_holiday       INTEGER,
  overtime_hours     NUMERIC,
  committed          BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
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
  v_net_pay        NUMERIC;
  v_period_year    INTEGER;
BEGIN
  -- ── 1. Load period ──────────────────────────────────────────────────────
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

  -- ── 2. Load TSS parameters ─────────────────────────────────────────────
  SELECT
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'afp_employee_pct'), 2.87),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'sfs_employee_pct'), 3.04),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'afp_cap_monthly'),  420000),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'sfs_cap_monthly'),  210000)
  INTO v_afp_emp_pct, v_sfs_emp_pct, v_afp_cap, v_sfs_cap
  FROM tss_parameters
  WHERE effective_date <= v_period.end_date;

  -- ── 3. Loop employees ──────────────────────────────────────────────────
  FOR v_emp IN
    SELECT e.id, e.name, e.salary, e.entity_id
    FROM employees e
    WHERE e.is_active = true
      AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
    ORDER BY e.name
  LOOP
    v_daily_rate  := round(v_emp.salary / 23.83, 4);
    v_hourly_rate := round(v_daily_rate / 8, 4);

    -- ── 3a. Aggregate timesheets ────────────────────────────────────────
    SELECT
      -- Days worked: non-absent, non-holiday, with actual hours
      COUNT(*) FILTER (
        WHERE NOT ts.is_absent
          AND NOT ts.is_holiday
          AND COALESCE(ts.hours_worked, 0) > 0
      )::INTEGER,
      -- Days absent: exclude holidays
      COUNT(*) FILTER (
        WHERE ts.is_absent AND NOT ts.is_holiday
      )::INTEGER,
      -- Days holiday: only if employee actually worked on the holiday
      COUNT(*) FILTER (
        WHERE ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      )::INTEGER,
      -- Overtime hours: lunch-adjusted, Saturday threshold = 4
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
        WHERE NOT ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ), 0),
      -- Sunday hours: lunch-adjusted
      COALESCE(SUM(
        CASE WHEN ts.hours_worked > 5 THEN ts.hours_worked - 1 ELSE ts.hours_worked END
      ) FILTER (
        WHERE EXTRACT(DOW FROM ts.work_date) = 0
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ), 0)
    INTO v_days_worked, v_days_absent, v_days_holiday, v_ot_hours, v_sunday_hours
    FROM employee_timesheets ts
    WHERE ts.employee_id = v_emp.id
      AND ts.period_id   = p_period_id;

    -- ── 3b. Pay calculations ────────────────────────────────────────────
    v_base_pay     := round(v_emp.salary / 2, 2);
    v_absence_ded  := round(v_days_absent * (v_emp.salary / 30), 2);
    v_overtime_pay := round(v_ot_hours * v_hourly_rate * 0.35, 2);
    v_holiday_pay  := round(v_days_holiday * v_daily_rate, 2);
    v_sunday_pay   := round(v_sunday_hours * v_hourly_rate * 0.35, 2);

    -- ── 3c. Benefits: period overrides first, then recurring / 2 ────────
    SELECT COALESCE(SUM(amount), 0) INTO v_benefits
    FROM period_employee_benefits
    WHERE period_id = p_period_id AND employee_id = v_emp.id;

    IF v_benefits = 0 THEN
      SELECT COALESCE(SUM(amount) / 2, 0) INTO v_benefits
      FROM employee_benefits
      WHERE employee_id = v_emp.id AND is_recurring = true AND amount > 0;
    END IF;
    v_benefits := round(v_benefits, 2);

    -- ── 3d. Gross ───────────────────────────────────────────────────────
    v_gross_pay := round(v_base_pay - v_absence_ded + v_overtime_pay + v_holiday_pay + v_sunday_pay + v_benefits, 2);

    -- ── 3e. TSS (AFP + SFS) ─────────────────────────────────────────────
    v_tss := round((
      LEAST(v_emp.salary, v_afp_cap) * v_afp_emp_pct / 100.0 +
      LEAST(v_emp.salary, v_sfs_cap) * v_sfs_emp_pct / 100.0
    ) / 2, 2);

    -- ── 3f. ISR ─────────────────────────────────────────────────────────
    v_isr := round(GREATEST(
      public.calculate_annual_isr(
        GREATEST(0, (v_gross_pay - v_benefits) * 24 - v_tss * 24),
        v_period_year
      ) / 24,
      0
    ), 2);

    -- ── 3g. Loan deduction ──────────────────────────────────────────────
    SELECT COALESCE(SUM(payment_amount), 0) INTO v_loan_ded
    FROM employee_loans
    WHERE employee_id = v_emp.id AND is_active = true AND remaining_payments > 0;
    v_loan_ded := round(v_loan_ded, 2);

    v_vacation_ded := 0;

    v_net_pay := round(v_gross_pay - v_tss - v_isr - v_loan_ded - v_vacation_ded, 2);

    -- ── 3h. Commit: write snapshot + decrement loans ────────────────────
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

      -- Decrement loan remaining payments
      UPDATE employee_loans
      SET remaining_payments = remaining_payments - 1,
          is_active = (remaining_payments - 1 > 0),
          updated_at = now()
      WHERE employee_id = v_emp.id AND is_active = true AND remaining_payments > 0;
    END IF;

    -- ── 3i. Return row ──────────────────────────────────────────────────
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
    total_deductions   := round(v_tss + v_isr + v_loan_ded + v_vacation_ded, 2);
    net_pay            := v_net_pay;
    days_worked        := v_days_worked;
    days_absent        := v_days_absent;
    days_holiday       := v_days_holiday;
    overtime_hours     := v_ot_hours;
    committed          := p_commit;
    RETURN NEXT;
  END LOOP;
END;
$$;
