CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(
  p_period_id uuid,
  p_commit boolean DEFAULT false,
  p_entity_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  employee_id uuid,
  employee_name text,
  salary numeric,
  base_pay numeric,
  overtime_pay numeric,
  holiday_pay numeric,
  sunday_pay numeric,
  total_benefits numeric,
  gross_pay numeric,
  tss numeric,
  isr numeric,
  loan_deduction numeric,
  absence_deduction numeric,
  vacation_deduction numeric,
  total_deductions numeric,
  net_pay numeric,
  days_worked integer,
  days_absent integer,
  days_holiday integer,
  overtime_hours numeric,
  committed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT parameter_value::NUMERIC INTO v_afp_pct FROM tss_parameters WHERE parameter_key = 'employee_afp_rate';
  SELECT parameter_value::NUMERIC INTO v_sfs_pct FROM tss_parameters WHERE parameter_key = 'employee_sfs_rate';
  SELECT parameter_value::NUMERIC INTO v_afp_cap FROM tss_parameters WHERE parameter_key = 'afp_salary_cap';
  SELECT parameter_value::NUMERIC INTO v_sfs_cap FROM tss_parameters WHERE parameter_key = 'sfs_salary_cap';

  FOR v_emp IN
    SELECT e.id, e.name, e.salary
    FROM employees e
    WHERE e.is_active = true
      AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
    ORDER BY e.name
  LOOP
    v_daily_rate  := v_emp.salary / 23.83;
    v_hourly_rate := v_daily_rate / 8;

    SELECT
      COUNT(*) FILTER (
        WHERE NOT ts.is_absent
          AND NOT ts.is_holiday
          AND COALESCE(ts.hours_worked, 0) > 0
      ),
      COUNT(*) FILTER (
        WHERE ts.is_absent
      ),
      COUNT(*) FILTER (
        WHERE ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ),
      COALESCE(SUM(GREATEST(ts.hours_worked - 8, 0)) FILTER (
        WHERE NOT ts.is_holiday
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ), 0),
      COALESCE(SUM(ts.hours_worked) FILTER (
        WHERE EXTRACT(DOW FROM ts.work_date) = 0
          AND NOT ts.is_absent
          AND COALESCE(ts.hours_worked, 0) > 0
      ), 0),
      COALESCE(SUM(ts.hours_worked) FILTER (
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
    v_hol_pay  := v_holiday_hours * v_hourly_rate;
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
    total_benefits     := v_benefits;
    gross_pay          := v_gross;
    tss                := v_tss;
    isr                := v_isr;
    loan_deduction     := v_loan_ded;
    absence_deduction  := v_abs_ded;
    vacation_deduction := v_vac_ded;
    total_deductions   := v_total_ded;
    net_pay            := v_net;
    days_worked        := v_days_worked;
    days_absent        := v_days_absent;
    days_holiday       := v_days_holiday;
    overtime_hours     := v_ot_hours;
    committed          := false;

    IF p_commit THEN
      INSERT INTO payroll_snapshots (
        period_id, employee_id,
        base_pay, overtime_pay, holiday_pay, sunday_pay, total_benefits,
        tss, isr, loan_deduction, absence_deduction, vacation_deduction,
        gross_pay, net_pay
      ) VALUES (
        p_period_id, v_emp.id,
        v_base_pay, v_ot_pay, v_hol_pay, v_sun_pay, v_benefits,
        v_tss, v_isr, v_loan_ded, v_abs_ded, v_vac_ded,
        v_gross, v_net
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

      UPDATE employee_loans
        SET remaining_payments = remaining_payments - 1,
            is_active = (remaining_payments - 1 > 0)
        WHERE employee_id = v_emp.id
          AND is_active = true
          AND remaining_payments > 0;

      committed := true;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$;