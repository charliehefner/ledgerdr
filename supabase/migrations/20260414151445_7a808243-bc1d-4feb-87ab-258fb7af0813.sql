
DROP FUNCTION IF EXISTS public.calculate_payroll_for_period(UUID, BOOLEAN, UUID);

CREATE FUNCTION public.calculate_payroll_for_period(
  p_period_id UUID,
  p_commit    BOOLEAN,
  p_entity_id UUID
)
RETURNS TABLE(
  employee_id        UUID,
  employee_name      TEXT,
  salary             NUMERIC,
  base_pay           NUMERIC,
  overtime_pay       NUMERIC,
  holiday_pay        NUMERIC,
  sunday_pay         NUMERIC,
  benefits           NUMERIC,
  gross_pay          NUMERIC,
  tss_deduction      NUMERIC,
  isr_deduction      NUMERIC,
  loan_deduction     NUMERIC,
  absence_deduction  NUMERIC,
  vacation_deduction NUMERIC,
  total_deductions   NUMERIC,
  net_pay            NUMERIC,
  days_worked        INTEGER,
  days_absent        INTEGER,
  days_holiday       INTEGER,
  overtime_hours     NUMERIC,
  sunday_hours       NUMERIC,
  holiday_hours      NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_emp           RECORD;
  v_period        RECORD;
  v_daily_rate    NUMERIC;
  v_hourly_rate   NUMERIC;
  v_base_pay      NUMERIC;
  v_ot_pay        NUMERIC;
  v_hol_pay       NUMERIC;
  v_sun_pay       NUMERIC;
  v_benefits      NUMERIC;
  v_gross         NUMERIC;
  v_tss           NUMERIC;
  v_isr           NUMERIC;
  v_loan_ded      NUMERIC;
  v_abs_ded       NUMERIC;
  v_vac_ded       NUMERIC;
  v_total_ded     NUMERIC;
  v_net           NUMERIC;
  v_days_worked   INTEGER;
  v_days_absent   INTEGER;
  v_days_holiday  INTEGER;
  v_ot_hours      NUMERIC;
  v_sun_hours     NUMERIC;
  v_holiday_hours NUMERIC;
  v_afp_pct       NUMERIC;
  v_sfs_pct       NUMERIC;
  v_afp_cap       NUMERIC;
  v_sfs_cap       NUMERIC;
  v_annual_gross  NUMERIC;
  v_annual_isr    NUMERIC;
BEGIN
  SELECT * INTO v_period FROM payroll_periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period % not found', p_period_id;
  END IF;
  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'Cannot calculate payroll for a closed period';
  END IF;

  -- Correct parameter keys; divide by 100 since stored as 2.87 / 3.04
  SELECT COALESCE(parameter_value::NUMERIC, 2.87) / 100.0 INTO v_afp_pct FROM tss_parameters WHERE parameter_key = 'afp_employee_pct';
  SELECT COALESCE(parameter_value::NUMERIC, 3.04) / 100.0 INTO v_sfs_pct FROM tss_parameters WHERE parameter_key = 'sfs_employee_pct';
  SELECT COALESCE(parameter_value::NUMERIC, 355440) INTO v_afp_cap FROM tss_parameters WHERE parameter_key = 'afp_cap_monthly';
  SELECT COALESCE(parameter_value::NUMERIC, 355440) INTO v_sfs_cap FROM tss_parameters WHERE parameter_key = 'sfs_cap_monthly';

  v_afp_pct := COALESCE(v_afp_pct, 2.87 / 100.0);
  v_sfs_pct := COALESCE(v_sfs_pct, 3.04 / 100.0);
  v_afp_cap := COALESCE(v_afp_cap, 355440);
  v_sfs_cap := COALESCE(v_sfs_cap, 355440);

  FOR v_emp IN
    SELECT e.id, e.name, e.salary
    FROM employees e
    WHERE e.is_active = true
      AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
    ORDER BY e.name
  LOOP
    v_daily_rate  := v_emp.salary / 23.83;
    v_hourly_rate := v_daily_rate / 8;

    -- hours_worked is a generated column storing CLOCK hours (includes lunch).
    -- We must apply a 1-hour lunch deduction for shifts > 5 clock hours
    -- to get actual WORK hours, matching the client-side Timesheet calculation.
    SELECT
      -- Days worked: non-absent, non-holiday, with actual hours
      COUNT(*) FILTER (
        WHERE NOT ts.is_absent
          AND NOT ts.is_holiday
          AND COALESCE(ts.hours_worked, 0) > 0
      ),
      -- Days absent: exclude holidays
      COUNT(*) FILTER (
        WHERE ts.is_absent AND NOT ts.is_holiday
      ),
      -- Days holiday: only if employee actually worked on the holiday
      COUNT(*) FILTER (
        WHERE ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ),
      -- Overtime hours: lunch-adjusted clock hours minus 8-hour standard day
      -- Saturday (DOW=6): threshold is 4 hours (half day, no lunch for short shifts)
      COALESCE(SUM(
        GREATEST(
          CASE
            WHEN EXTRACT(DOW FROM ts.work_date) = 6 THEN
              -- Saturday: no lunch deduction for <= 5 clock hrs
              CASE WHEN ts.hours_worked > 5 THEN ts.hours_worked - 1 ELSE ts.hours_worked END - 4
            ELSE
              -- Weekday: deduct 1hr lunch if > 5 clock hrs, then subtract 8hr standard
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
      ), 0),
      -- Holiday hours: lunch-adjusted (kept for reference/display only)
      COALESCE(SUM(
        CASE WHEN ts.hours_worked > 5 THEN ts.hours_worked - 1 ELSE ts.hours_worked END
      ) FILTER (
        WHERE ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ), 0)
    INTO v_days_worked, v_days_absent, v_days_holiday, v_ot_hours, v_sun_hours, v_holiday_hours
    FROM employee_timesheets ts
    WHERE ts.employee_id = v_emp.id
      AND ts.period_id   = p_period_id;

    v_base_pay := v_emp.salary / 2;
    v_abs_ded  := v_days_absent * (v_emp.salary / 30);
    v_ot_pay   := v_ot_hours * v_hourly_rate * 0.35;
    -- BUG 2 FIX: Holiday pay = days × daily rate (not hours × hourly rate)
    v_hol_pay  := v_days_holiday * v_daily_rate;
    v_sun_pay  := v_sun_hours * v_hourly_rate * 0.35;

    SELECT COALESCE(SUM(b.amount), 0) INTO v_benefits
    FROM employee_benefits b
    WHERE b.employee_id = v_emp.id AND b.is_recurring = true;

    v_gross := v_base_pay - v_abs_ded + v_ot_pay + v_hol_pay + v_sun_pay + v_benefits;

    v_tss := (LEAST(v_emp.salary, v_afp_cap) * v_afp_pct
            + LEAST(v_emp.salary, v_sfs_cap) * v_sfs_pct) / 2;

    v_annual_gross := (v_gross - v_benefits) * 24;
    SELECT public.calculate_annual_isr(v_annual_gross - v_tss * 24) INTO v_annual_isr;
    v_isr := GREATEST(v_annual_isr / 24, 0);

    SELECT COALESCE(SUM(l.payment_amount), 0) INTO v_loan_ded
    FROM employee_loans l
    WHERE l.employee_id = v_emp.id AND l.is_active = true AND l.remaining_payments > 0;

    v_vac_ded   := 0;
    v_total_ded := v_tss + v_isr + v_loan_ded + v_abs_ded + v_vac_ded;
    v_net       := v_gross - v_tss - v_isr - v_loan_ded - v_vac_ded;

    employee_id        := v_emp.id;
    employee_name      := v_emp.name;
    salary             := v_emp.salary;
    base_pay           := v_base_pay;
    overtime_pay       := v_ot_pay;
    holiday_pay        := v_hol_pay;
    sunday_pay         := v_sun_pay;
    benefits           := v_benefits;
    gross_pay          := v_gross;
    tss_deduction      := v_tss;
    isr_deduction      := v_isr;
    loan_deduction     := v_loan_ded;
    absence_deduction  := v_abs_ded;
    vacation_deduction := v_vac_ded;
    total_deductions   := v_total_ded;
    net_pay            := v_net;
    days_worked        := v_days_worked;
    days_absent        := v_days_absent;
    days_holiday       := v_days_holiday;
    overtime_hours     := v_ot_hours;
    sunday_hours       := v_sun_hours;
    holiday_hours      := v_holiday_hours;
    RETURN NEXT;

    IF p_commit THEN
      INSERT INTO payroll_snapshots (
        period_id, employee_id, employee_name, salary,
        base_pay, overtime_pay, holiday_pay, sunday_pay,
        benefits, gross_pay, tss_deduction, isr_deduction,
        loan_deduction, absence_deduction, vacation_deduction,
        total_deductions, net_pay, days_worked, days_absent,
        days_holiday, overtime_hours, sunday_hours, holiday_hours
      ) VALUES (
        p_period_id, v_emp.id, v_emp.name, v_emp.salary,
        v_base_pay, v_ot_pay, v_hol_pay, v_sun_pay,
        v_benefits, v_gross, v_tss, v_isr,
        v_loan_ded, v_abs_ded, v_vac_ded,
        v_total_ded, v_net, v_days_worked, v_days_absent,
        v_days_holiday, v_ot_hours, v_sun_hours, v_holiday_hours
      )
      ON CONFLICT (period_id, employee_id) DO UPDATE SET
        employee_name      = EXCLUDED.employee_name,
        salary             = EXCLUDED.salary,
        base_pay           = EXCLUDED.base_pay,
        overtime_pay       = EXCLUDED.overtime_pay,
        holiday_pay        = EXCLUDED.holiday_pay,
        sunday_pay         = EXCLUDED.sunday_pay,
        benefits           = EXCLUDED.benefits,
        gross_pay          = EXCLUDED.gross_pay,
        tss_deduction      = EXCLUDED.tss_deduction,
        isr_deduction      = EXCLUDED.isr_deduction,
        loan_deduction     = EXCLUDED.loan_deduction,
        absence_deduction  = EXCLUDED.absence_deduction,
        vacation_deduction = EXCLUDED.vacation_deduction,
        total_deductions   = EXCLUDED.total_deductions,
        net_pay            = EXCLUDED.net_pay,
        days_worked        = EXCLUDED.days_worked,
        days_absent        = EXCLUDED.days_absent,
        days_holiday       = EXCLUDED.days_holiday,
        overtime_hours     = EXCLUDED.overtime_hours,
        sunday_hours       = EXCLUDED.sunday_hours,
        holiday_hours      = EXCLUDED.holiday_hours,
        updated_at         = now();
    END IF;
  END LOOP;
END;
$$;
