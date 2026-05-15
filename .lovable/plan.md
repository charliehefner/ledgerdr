## Linter cleanup plan

The linter reports 227 issues. After querying the DB I found that almost all are duplicates of two noisy categories. Real, unique fixes are small.

### What I'll fix (single SQL migration)

1. **ERROR — Security Definer View (1 issue)**
   - The only view missing `security_invoker` is `public.employees_safe`. All others (`general_ledger`, `v_trial_balance`, `home_office_balance`, etc.) already have `security_invoker=on`.
   - Fix: `ALTER VIEW public.employees_safe SET (security_invoker = on);`

2. **WARN — Function Search Path Mutable (1 real issue)**
   - Only `public.fn_set_updated_at()` is missing `search_path`.
   - Fix: `ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;`

3. **WARN — Public (anon) can execute SECURITY DEFINER function (~108 issues)**
   - 108 of our `SECURITY DEFINER` RPCs currently grant `EXECUTE` to `anon` / `PUBLIC`. None of them are meant to be called by signed-out users (login goes through Supabase Auth, not these RPCs).
   - Fix: blanket `REVOKE EXECUTE ... FROM anon, PUBLIC` on every `SECURITY DEFINER` function in `public`. Authenticated users keep access.
   - This single change clears all ~108 anon warnings at once.

4. **WARN — RLS policy always true (1 issue)**
   - `app_error_log` INSERT policy uses `WITH CHECK (true)`.
   - Fix: replace with `WITH CHECK (auth.uid() IS NOT NULL)` so only signed-in users can write error logs. No behavior change for the app.

### What I'll intentionally leave alone

- **WARN — Authenticated users can execute SECURITY DEFINER (~115 issues).** These RPCs (`calculate_payroll_for_period`, `apply_ap_ar_payment`, `create_internal_transfer`, `drilldown_resolve`, etc.) are exactly the API surface the app calls from the browser. Revoking would break the application. This warning is informational for our architecture and is expected to stay.
- **WARN — Extension in public (`pg_net`, 1 issue).** Moving `pg_net` out of `public` would break existing scheduled jobs and any code that calls `net.http_post(...)` without a schema-qualified path. Risk far outweighs benefit; recommend leaving as-is.

### Expected result after migration

- 1 ERROR → 0
- ~227 WARN → ~117 WARN (only the "authenticated SECDEF executable" + `pg_net` ones, all intentional).

### Files

- New SQL migration only. No frontend changes.
