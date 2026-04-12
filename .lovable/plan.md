

## Generate Complete Technical Migration Document

### What Will Be Created

A single file **`docs/migration.md`** (~4000+ lines) committed to the repository, immediately visible in GitHub after Lovable's auto-sync.

### Data Collected

All data has been gathered from the live database and codebase:

- **93 tables** with full column definitions, types, constraints, defaults
- **~200 RLS policies** with verbatim USING/WITH CHECK expressions
- **~60 database functions** with full CREATE OR REPLACE definitions
- **10 views** with complete SQL definitions
- **~150 indexes** including unique constraints
- **~100 foreign key relationships**
- **4 enums** (app_role, inventory_function, liquidation_case_status, prestaciones_scenario)
- **19 Edge Functions** with purposes and secret dependencies
- **2 storage buckets** (both private, no size/mime restrictions)
- **8 files** with storage interactions
- **0 Realtime subscriptions** (confirmed)
- **6 secrets** (DALLAS_AGRO_API_KEY, GPSGATE_API_KEY, LOVABLE_API_KEY, NANONETS_API_KEY, NANONETS_MODEL_ID, TELEGRAM_API_KEY)
- **Complete auth architecture** (email/password, 6-role RBAC, MFA stub, JWT via Supabase GoTrue)
- **Complete permissions system** (route-to-section mapping, read/write matrices)

### Document Sections

1. **Supabase Dependencies Inventory** — Every feature used, every SDK call location
2. **Complete Database Schema** — Executable SQL for all 93 tables, 10 views, 60 functions, 200 RLS policies, 150 indexes, all FKs
3. **Environment Variables** — All 4 VITE vars + 6 secrets with file references
4. **Authentication Architecture** — End-to-end flow with recommended Node.js replacement
5. **File Storage Usage** — Both buckets, all 8 files, naming conventions, DO Spaces migration path
6. **Realtime & WebSocket Usage** — Confirmed not used
7. **Frontend Architecture** — React 18 + Vite 5, all components with direct Supabase calls, state management
8. **Third Party Integrations** — GPSGate, Telegram, Nanonets OCR, Dallas Agro API, Lovable AI
9. **Migration Risk Assessment** — Top 5 risks with verification steps
10. **Recommended Migration Sequence** — Layer-by-layer with verification gates

### Execution

Single `code--write` call to create `docs/migration.md`. The document will contain verbatim SQL from the live database queries, exact file paths, and function-level detail. No summarization.

