
CREATE OR REPLACE FUNCTION public.calculate_prestaciones(
  p_employee_id uuid,
  p_termination_date date,
  p_scenario text DEFAULT 'desahucio'::text,
  p_worked_notice boolean DEFAULT false,
  p_pending_vacation_days numeric DEFAULT NULL::numeric,
  p_include_loans boolean DEFAULT true,
  p_manual_adjustments numeric DEFAULT 0,
  p_manual_deductions numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee RECORD;
  v_daily_divisor NUMERIC := 23.83;
  v_avg_monthly_salary NUMERIC := 0;
  v_avg_monthly_salary_12m NUMERIC := 0;
  v_daily_salary NUMERIC := 0;
  v_daily_salary_vacation NUMERIC := 0;
  v_service_interval INTERVAL;
  v_service_years INTEGER := 0;
  v_service_months INTEGER := 0;
  v_service_days INTEGER := 0;
  v_total_service_months NUMERIC := 0;
  v_total_service_days INTEGER := 0;
  v_remainder_months NUMERIC := 0;
  v_days_from_years NUMERIC := 0;
  v_days_from_remainder NUMERIC := 0;
  v_preaviso_days NUMERIC := 0;
  v_preaviso_amount NUMERIC := 0;
  v_cesantia_days NUMERIC := 0;
  v_cesantia_amount NUMERIC := 0;
  v_pending_vacation_days NUMERIC := 0;
  v_vacation_amount NUMERIC := 0;
  v_regalia_amount NUMERIC := 0;
  v_loan_deductions NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_last_vacation_end DATE;
  v_vacation_anchor DATE;
  v_vacation_entitlement NUMERIC := 14;
  v_earnings_current_year NUMERIC := 0;
  v_segments JSONB := '[]'::jsonb;
  v_param_value NUMERIC;
  v_vacation_window_start DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'accountant')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to calculate prestaciones';
  END IF;

  SELECT * INTO v_employee FROM public.employees WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF p_termination_date < v_employee.date_of_hire THEN
    RAISE EXCEPTION 'Termination date cannot be before hire date';
  END IF;

  SELECT COALESCE(MAX(end_date), NULL)
  INTO v_last_vacation_end
  FROM public.employee_vacations
  WHERE employee_id = p_employee_id
    AND end_date <= p_termination_date;

  SELECT numeric_value
  INTO v_param_value
  FROM public.prestaciones_parameters
  WHERE scope = 'general' AND parameter_key = 'daily_salary_divisor'
  LIMIT 1;

  v_daily_divisor := COALESCE(v_param_value, 23.83);

  -- Full-history weighted average (basis for cesantía / preaviso / regalía)
  WITH raw_history AS (
    SELECT effective_date::date AS effective_date, salary::numeric AS salary
    FROM public.employee_salary_history
    WHERE employee_id = p_employee_id
      AND effective_date <= p_termination_date
  ),
  seeded_history AS (
    SELECT * FROM raw_history
    UNION ALL
    SELECT v_employee.date_of_hire, COALESCE(
      (SELECT salary FROM raw_history ORDER BY effective_date ASC LIMIT 1),
      v_employee.salary::numeric
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM raw_history WHERE effective_date = v_employee.date_of_hire
    )
  ),
  ordered_history AS (
    SELECT DISTINCT ON (effective_date) effective_date, salary
    FROM seeded_history
    ORDER BY effective_date, salary DESC
  ),
  segments AS (
    SELECT
      GREATEST(effective_date, v_employee.date_of_hire) AS segment_start,
      LEAST(
        COALESCE((LEAD(effective_date) OVER (ORDER BY effective_date) - INTERVAL '1 day')::date, p_termination_date),
        p_termination_date
      ) AS segment_end,
      salary
    FROM ordered_history
    WHERE effective_date <= p_termination_date
  ),
  clean_segments AS (
    SELECT
      segment_start, segment_end, salary,
      ((segment_end - segment_start) + 1) AS days_in_segment,
      ROUND((((segment_end - segment_start) + 1)::numeric / 30.0), 2) AS months_in_segment
    FROM segments
    WHERE segment_end >= segment_start
  )
  SELECT
    COALESCE(SUM(salary * days_in_segment) / NULLIF(SUM(days_in_segment), 0), v_employee.salary::numeric),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'start_date', segment_start, 'end_date', segment_end,
          'salary', ROUND(salary, 2),
          'days', days_in_segment, 'months', months_in_segment
        ) ORDER BY segment_start
      ), '[]'::jsonb
    )
  INTO v_avg_monthly_salary, v_segments
  FROM clean_segments;

  v_daily_salary := ROUND(v_avg_monthly_salary / NULLIF(v_daily_divisor, 0), 4);

  -- Last-12-months weighted average (Art. 177 — vacation basis)
  v_vacation_window_start := GREATEST(v_employee.date_of_hire, (p_termination_date - INTERVAL '12 months')::date + 1);

  WITH raw_history AS (
    SELECT effective_date::date AS effective_date, salary::numeric AS salary
    FROM public.employee_salary_history
    WHERE employee_id = p_employee_id
      AND effective_date <= p_termination_date
  ),
  seeded_history AS (
    SELECT * FROM raw_history
    UNION ALL
    SELECT v_employee.date_of_hire, COALESCE(
      (SELECT salary FROM raw_history ORDER BY effective_date ASC LIMIT 1),
      v_employee.salary::numeric
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM raw_history WHERE effective_date = v_employee.date_of_hire
    )
  ),
  ordered_history AS (
    SELECT DISTINCT ON (effective_date) effective_date, salary
    FROM seeded_history
    ORDER BY effective_date, salary DESC
  ),
  segments AS (
    SELECT
      GREATEST(effective_date, v_vacation_window_start) AS segment_start,
      LEAST(
        COALESCE((LEAD(effective_date) OVER (ORDER BY effective_date) - INTERVAL '1 day')::date, p_termination_date),
        p_termination_date
      ) AS segment_end,
      salary
    FROM ordered_history
    WHERE effective_date <= p_termination_date
  )
  SELECT COALESCE(
    SUM(salary * ((segment_end - segment_start) + 1))
    / NULLIF(SUM((segment_end - segment_start) + 1), 0),
    v_avg_monthly_salary
  )
  INTO v_avg_monthly_salary_12m
  FROM segments
  WHERE segment_end >= segment_start;

  v_daily_salary_vacation := ROUND(v_avg_monthly_salary_12m / NULLIF(v_daily_divisor, 0), 4);

  v_service_interval := age(p_termination_date, v_employee.date_of_hire);
  v_service_years := DATE_PART('year', v_service_interval);
  v_service_months := DATE_PART('month', v_service_interval);
  v_service_days := DATE_PART('day', v_service_interval);
  v_total_service_months := ROUND(((p_termination_date - v_employee.date_of_hire + 1)::numeric / 30.0), 4);
  v_total_service_days := (p_termination_date - v_employee.date_of_hire + 1);

  -- Remainder months in the last partial year (for cesantía tail)
  v_remainder_months := v_service_months + (v_service_days::numeric / 30.0);

  -- Preaviso (Art. 76)
  IF p_scenario = 'desahucio' AND NOT p_worked_notice THEN
    IF v_total_service_months >= 12 THEN
      v_preaviso_days := 28;
    ELSIF v_total_service_months >= 6 THEN
      v_preaviso_days := 14;
    ELSIF v_total_service_months >= 3 THEN
      v_preaviso_days := 7;
    END IF;
  END IF;

  v_preaviso_amount := ROUND(v_preaviso_days * v_daily_salary, 2);

  -- Cesantía (Art. 80) — complete years + partial-year tail
  IF p_scenario = 'desahucio' THEN
    IF v_service_years >= 5 THEN
      v_days_from_years := 23 * v_service_years;
    ELSIF v_service_years >= 1 THEN
      v_days_from_years := 21 * v_service_years;
    END IF;

    IF v_service_years >= 1 THEN
      -- Tail on top of complete years
      IF v_remainder_months >= 6 THEN
        v_days_from_remainder := 13;
      ELSIF v_remainder_months >= 3 THEN
        v_days_from_remainder := 6;
      END IF;
    ELSE
      -- Less than 1 complete year — original sub-year bands
      IF v_total_service_months >= 6 THEN
        v_days_from_remainder := 13;
      ELSIF v_total_service_months >= 3 THEN
        v_days_from_remainder := 6;
      END IF;
    END IF;

    v_cesantia_days := v_days_from_years + v_days_from_remainder;
  END IF;

  v_cesantia_amount := ROUND(v_cesantia_days * v_daily_salary, 2);

  -- Vacation entitlement (Art. 177)
  IF v_total_service_months >= 60 THEN
    v_vacation_entitlement := 18;
  END IF;

  v_vacation_anchor := COALESCE(v_last_vacation_end + 1, v_employee.date_of_hire);

  IF p_pending_vacation_days IS NOT NULL THEN
    v_pending_vacation_days := GREATEST(p_pending_vacation_days, 0);
  ELSE
    IF p_termination_date < v_vacation_anchor THEN
      v_pending_vacation_days := 0;
    ELSE
      v_pending_vacation_days := ROUND(
        LEAST(
          v_vacation_entitlement,
          v_vacation_entitlement * ((p_termination_date - v_vacation_anchor + 1)::numeric / 365.0)
        ), 2
      );
      IF v_pending_vacation_days >= (v_vacation_entitlement * 0.95) THEN
        v_pending_vacation_days := v_vacation_entitlement;
      END IF;
    END IF;
  END IF;

  -- Vacation paid on the 12-month average daily rate (Art. 177)
  v_vacation_amount := ROUND(v_pending_vacation_days * v_daily_salary_vacation, 2);

  -- Regalía proporcional (Law 16-92) — current calendar year only
  WITH raw_history AS (
    SELECT effective_date::date AS effective_date, salary::numeric AS salary
    FROM public.employee_salary_history
    WHERE employee_id = p_employee_id
      AND effective_date <= p_termination_date
  ),
  seeded_history AS (
    SELECT * FROM raw_history
    UNION ALL
    SELECT v_employee.date_of_hire, COALESCE(
      (SELECT salary FROM raw_history ORDER BY effective_date ASC LIMIT 1),
      v_employee.salary::numeric
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM raw_history WHERE effective_date = v_employee.date_of_hire
    )
  ),
  ordered_history AS (
    SELECT DISTINCT ON (effective_date) effective_date, salary
    FROM seeded_history
    ORDER BY effective_date, salary DESC
  ),
  segments AS (
    SELECT
      GREATEST(effective_date, GREATEST(date_trunc('year', p_termination_date)::date, v_employee.date_of_hire)) AS segment_start,
      LEAST(
        COALESCE((LEAD(effective_date) OVER (ORDER BY effective_date) - INTERVAL '1 day')::date, p_termination_date),
        p_termination_date
      ) AS segment_end,
      salary
    FROM ordered_history
    WHERE effective_date <= p_termination_date
  )
  SELECT COALESCE(SUM((salary / 30.0) * ((segment_end - segment_start) + 1)), 0)
  INTO v_earnings_current_year
  FROM segments
  WHERE segment_end >= segment_start;

  v_regalia_amount := ROUND(v_earnings_current_year / 12.0, 2);

  IF p_include_loans THEN
    SELECT COALESCE(SUM(payment_amount * remaining_payments), 0)
    INTO v_loan_deductions
    FROM public.employee_loans
    WHERE employee_id = p_employee_id AND is_active = true;
  END IF;

  v_total_amount := ROUND(
    v_preaviso_amount + v_cesantia_amount + v_vacation_amount + v_regalia_amount
    + COALESCE(p_manual_adjustments, 0)
    - COALESCE(v_loan_deductions, 0)
    - COALESCE(p_manual_deductions, 0),
    2
  );

  RETURN jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_employee.id, 'name', v_employee.name,
      'date_of_hire', v_employee.date_of_hire,
      'date_of_termination', v_employee.date_of_termination
    ),
    'scenario', p_scenario,
    'termination_date', p_termination_date,
    'worked_notice', p_worked_notice,
    'salary_basis', jsonb_build_object(
      'average_monthly', ROUND(v_avg_monthly_salary, 2),
      'average_monthly_12m', ROUND(v_avg_monthly_salary_12m, 2),
      'daily_divisor', v_daily_divisor,
      'daily_salary', v_daily_salary,
      'daily_salary_vacation', v_daily_salary_vacation
    ),
    'service_time', jsonb_build_object(
      'years', v_service_years, 'months', v_service_months, 'days', v_service_days,
      'total_months', ROUND(v_total_service_months, 2),
      'total_days', v_total_service_days
    ),
    'line_items', jsonb_build_object(
      'preaviso_days', v_preaviso_days,
      'preaviso_amount', v_preaviso_amount,
      'cesantia_days', v_cesantia_days,
      'cesantia_amount', v_cesantia_amount,
      'cesantia_breakdown', jsonb_build_object(
        'complete_years', v_service_years,
        'remainder_months', ROUND(v_remainder_months, 2),
        'days_from_years', v_days_from_years,
        'days_from_remainder', v_days_from_remainder
      ),
      'pending_vacation_days', v_pending_vacation_days,
      'vacation_amount', v_vacation_amount,
      'regalia_amount', v_regalia_amount,
      'loan_deductions', ROUND(v_loan_deductions, 2),
      'manual_adjustments', ROUND(COALESCE(p_manual_adjustments, 0), 2),
      'manual_deductions', ROUND(COALESCE(p_manual_deductions, 0), 2),
      'total_amount', v_total_amount
    ),
    'salary_segments', v_segments,
    'vacation_context', jsonb_build_object(
      'last_vacation_end', v_last_vacation_end,
      'accrual_anchor', v_vacation_anchor,
      'vacation_entitlement_days', v_vacation_entitlement,
      'vacation_window_start', v_vacation_window_start
    )
  );
END;
$function$;
