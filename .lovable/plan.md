

# E2E Testing Setup with Playwright

## Recommendation: Playwright

**Why Playwright over Cypress:**
- Faster execution, runs tests in parallel by default
- Built-in auto-wait (no flaky `cy.wait()` calls)
- Multi-browser support (Chromium, Firefox, WebKit)
- Better TypeScript support out of the box
- Works well with Vite projects

## What I'll Do

1. **Install Playwright** — add `@playwright/test` as a dev dependency and generate config
2. **Create `playwright.config.ts`** — pointed at `http://localhost:8080` (your Vite dev server)
3. **Write initial E2E tests** covering your most error-prone flows:
   - Login flow (valid credentials, error handling)
   - Jornaleros registration (the `entity_id` bug class)
   - Fuel Driver Portal wizard (full submit flow)
   - AI Search bar query
   - Navigation between major modules
4. **Add npm script** — `"test:e2e": "playwright test"`

## What You'll Need To Do

- **Log in once** in the preview so the auth session is active, OR provide test credentials I can embed in the test setup (a test user email/password)
- Playwright tests run against a live server, so the preview must be running (it already is in Lovable)

## Limitations in Lovable Sandbox

Playwright needs a running browser. I can install it and write the tests, but **running them requires either**:
1. The Lovable preview server to be accessible at localhost:8080 (it is during dev)
2. A CI pipeline (GitHub Actions) for ongoing regression — I can generate the workflow file too

I'll install, configure, and write the tests. Then we'll run them together.

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Add `@playwright/test` dev dep + `test:e2e` script |
| `playwright.config.ts` | New — config targeting localhost:8080 |
| `e2e/auth.setup.ts` | New — shared login setup |
| `e2e/login.spec.ts` | New — login flow test |
| `e2e/jornaleros.spec.ts` | New — registration with entity_id |
| `e2e/fuel-wizard.spec.ts` | New — driver portal fueling flow |
| `e2e/ai-search.spec.ts` | New — AI search query |
| `e2e/navigation.spec.ts` | New — module navigation smoke test |

