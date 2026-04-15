
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(
  p_period_id UUID,
  p_entity_id UUID DEFAULT NULL,
  p_commit BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  entity_id UUID,
  base_pay NUMERIC,
  overtime_hours NUMERIC,
  overtime_pay NUMERIC,
  holiday_pay NUMERIC,
  sunday_pay NUMERIC,
  total_benefits NUMERIC,
  tss NUMERIC,
  isr NUMERIC,
  absence_deduction NUMERIC,
  vacation_deduction NUMERIC,
  loan_deduction NUMERIC,
  total_deductions NUMERIC,
  gross_pay NUMERIC,
  net_pay NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_total_ded      NUMERIC;
  v_net_pay        NUMERIC;
  v_period_year    INTEGER;
BEGIN
  -- 1. Load period
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

  -- 2. Load TSS parameters
  SELECT
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'afp_employee_pct'), 2.87),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'sfs_employee_pct'), 3.04),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'afp_cap_monthly'),  420000),
    COALESCE(MAX(parameter_value) FILTER (WHERE parameter_key = 'sfs_cap_monthly'),  210000)
  INTO v_afp_emp_pct, v_sfs_emp_pct, v_afp_cap, v_sfs_cap
  FROM tss_parameters
  WHERE effective_date <= v_period.end_date;

  -- 3. Loop employees
  FOR v_emp IN
    SELECT e.id, e.name, e.salary, e.entity_id
    FROM employees e
    WHERE e.is_active = true
      AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
    ORDER BY e.name
  LOOP
    v_daily_rate  := round(v_emp.salary / 23.83, 4);
    v_hourly_rate := round(v_daily_rate / 8, 4);

    -- 3a. Aggregate timesheets
    SELECT
      COUNT(*) FILTER (
        WHERE NOT ts.is_absent
          AND NOT ts.is_holiday
          AND COALESCE(ts.hours_worked, 0) > 0
      )::INTEGER,
      COUNT(*) FILTER (
        WHERE ts.is_absent AND NOT ts.is_holiday
      )::INTEGER,
      COUNT(*) FILTER (
        WHERE ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
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
        WHERE NOT ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ), 0),
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

    -- 3b. Pay calculations
    v_base_pay     := round(v_emp.salary / 2, 2);
    v_absence_ded  := round(v_days_absent * (v_emp.salary / 30), 2);
    v_overtime_pay := round(v_ot_hours * v_hourly_rate * 0.35, 2);
    v_holiday_pay  := round(v_days_holiday * v_daily_rate, 2);
    v_sunday_pay   := round(v_sunday_hours * v_hourly_rate * 0.35, 2);

    -- 3c. Benefits: period overrides first, then recurring at FULL stored value
    SELECT COALESCE(SUM(peb.amount), 0) INTO v_benefits
    FROM period_employee_benefits peb
    WHERE peb.period_id = p_period_id AND peb.employee_id = v_emp.id;

    IF v_benefits = 0 THEN
      SELECT COALESCE(SUM(eb.amount), 0) INTO v_benefits
      FROM employee_benefits eb
      WHERE eb.employee_id = v_emp.id AND eb.is_recurring = true AND eb.amount > 0;
    END IF;

    -- 3d. Gross pay
    v_gross_pay := v_base_pay + v_overtime_pay + v_holiday_pay + v_sunday_pay + v_benefits - v_absence_ded;

    -- vacation deduction
    v_vacation_ded := 0;

    -- 3e. TSS (AFP + SFS)
    v_tss := round(
      LEAST(v_gross_pay, v_afp_cap / 2) * v_afp_emp_pct / 100
      + LEAST(v_gross_pay, v_sfs_cap / 2) * v_sfs_emp_pct / 100,
      2
    );

    -- 3f. ISR (annual bracket → per-period)
    DECLARE
      v_annual_gross NUMERIC;
      v_annual_tss   NUMERIC;
      v_taxable      NUMERIC;
      v_annual_isr   NUMERIC;
    BEGIN
      v_annual_gross := v_gross_pay * 24;
      v_annual_tss   := v_tss * 24;
      v_taxable      := v_annual_gross - v_annual_tss;
      IF v_period_year >= 2025 THEN
        IF v_taxable <= 476220 THEN v_annual_isr := 0;
        ELSIF v_taxable <= 714329 THEN v_annual_isr := (v_taxable - 476220) * 0.15;
        ELSIF v_taxable <= 992496 THEN v_annual_isr := 35716.35 + (v_taxable - 714329) * 0.20;
        ELSE v_annual_isr := 91349.75 + (v_taxable - 992496) * 0.25;
        END IF;
      ELSE
        IF v_taxable <= 416220 THEN v_annual_isr := 0;
        ELSIF v_taxable <= 624329 THEN v_annual_isr := (v_taxable - 416220) * 0.15;
        ELSIF v_taxable <= 867123 THEN v_annual_isr := 31216.35 + (v_taxable - 624329) * 0.20;
        ELSE v_annual_isr := 79775.15 + (v_taxable - 867123) * 0.25;
        END IF;
      END IF;
      v_isr := round(v_annual_isr / 24, 2);
    END;

    -- 3g. Loan deductions
    SELECT COALESCE(SUM(el.payment_amount), 0) INTO v_loan_ded
    FROM employee_loans el
    WHERE el.employee_id = v_emp.id
      AND el.is_active = true
      AND el.remaining_payments > 0;

    -- 3h. Total deductions & net
    v_total_ded := v_tss + v_isr + v_loan_ded + v_absence_ded + v_vacation_ded;
    v_net_pay   := v_gross_pay - v_total_ded + v_absence_ded;

    -- 4. If committing, write snapshot + deduct loans
    IF p_commit THEN
      INSERT INTO payroll_snapshots (
        period_id, employee_id, employee_name, entity_id,
        base_pay, overtime_hours, overtime_pay, holiday_pay, sunday_pay,
        total_benefits, tss, isr, absence_deduction, vacation_deduction,
        loan_deduction, total_deductions, gross_pay, net_pay
      ) VALUES (
        p_period_id, v_emp.id, v_emp.name, v_emp.entity_id,
        v_base_pay, v_ot_hours, v_overtime_pay, v_holiday_pay, v_sunday_pay,
        v_benefits, v_tss, v_isr, v_absence_ded, v_vacation_ded,
        v_loan_ded, v_total_ded, v_gross_pay, v_net_pay
      );

      UPDATE employee_loans
      SET remaining_payments = remaining_payments - 1,
          is_active = CASE WHEN remaining_payments - 1 <= 0 THEN false ELSE true END,
          updated_at = now()
      WHERE employee_id = v_emp.id AND is_active = true AND remaining_payments > 0;
    END IF;

    employee_id       := v_emp.id;
    employee_name     := v_emp.name;
    entity_id         := v_emp.entity_id;
    base_pay          := v_base_pay;
    overtime_hours    := v_ot_hours;
    overtime_pay      := v_overtime_pay;
    holiday_pay       := v_holiday_pay;
    sunday_pay        := v_sunday_pay;
    total_benefits    := v_benefits;
    tss               := v_tss;
    isr               := v_isr;
    absence_deduction := v_absence_ded;
    vacation_deduction:= v_vacation_ded;
    loan_deduction    := v_loan_ded;
    total_deductions  := v_total_ded;
    gross_pay         := v_gross_pay;
    net_pay           := v_net_pay;
    RETURN NEXT;
  END LOOP;
END;
$$;
