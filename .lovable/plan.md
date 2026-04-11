

# Proactive Error Detection — What I Can Implement Now

From the 7 strategies discussed, here's what's actionable inside Lovable right now (excluding E2E which we'll do later):

## 1. Security Scan & RLS Hardening (ready now)

The scan just found **8 issues**, including 2 critical ones:
- `contact_bank_accounts` — bank account numbers readable by ALL authenticated users
- `service_entry_payments` — payment records across all entities exposed
- 4 additional tables with overly permissive SELECT policies

**Action:** Write migrations to tighten RLS policies on these 6 tables, scoping them to appropriate roles and entities.

## 2. Error Monitoring Table + Auto-Logging

Currently the ErrorBoundary just `console.error`s and shows a Spanish error page. Errors vanish when the user reloads.

**Action:**
- Create an `app_error_log` table (timestamp, user_id, error_message, stack_trace, page_url, user_agent)
- Modify ErrorBoundary to POST errors to the database (fire-and-forget, non-blocking)
- Add a global `window.onerror` / `unhandledrejection` handler to catch errors outside React
- Add an admin-only "Error Log" tab in Settings to review recent errors

## 3. Database Constraint Tightening

Catch bugs like the missing `entity_id` at the database level before they reach the UI.

**Action:**
- Audit key tables for missing NOT NULL constraints on critical foreign keys
- Add validation triggers where CHECK constraints aren't appropriate (time-based validations)
- Add missing unique constraints to prevent duplicate records

## 4. Integration Tests for Critical DB Operations

Expand the existing Vitest suite to test actual insert/update patterns that have caused bugs.

**Action:**
- Add tests for jornalero registration (entity_id required)
- Add tests for fuel transaction insertion (tank_id, entity_id, pump readings)
- Add tests for inventory stock mutations (quantity reconciliation)
- These mock Supabase calls and verify payloads include all required fields

## 5. Enable Leaked Password Protection

The linter flagged this is disabled — a one-click security improvement.

**Action:** Enable via auth configuration.

---

## Summary of Changes

| # | What | Files |
|---|------|-------|
| 1 | Tighten 6 RLS policies | 1 migration |
| 2 | Error monitoring table + logging | 1 migration + ErrorBoundary.tsx + new Settings tab |
| 3 | DB constraint audit + triggers | 1 migration |
| 4 | Integration tests | 3-4 new test files |
| 5 | Leaked password protection | Auth config change |

All of this can be done without any action from you.

