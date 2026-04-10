import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Shared authentication setup.
 *
 * Set E2E_EMAIL and E2E_PASSWORD environment variables before running.
 * Example:
 *   E2E_EMAIL=test@example.com E2E_PASSWORD=secret npx playwright test
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD env vars are required. " +
        "Run: E2E_EMAIL=you@example.com E2E_PASSWORD=yourpass npx playwright test"
    );
  }

  await page.goto("/login");
  await page.getByPlaceholder(/correo|email/i).fill(email);
  await page.getByPlaceholder(/contraseña|password/i).fill(password);
  await page.getByRole("button", { name: /iniciar|sign in|login/i }).click();

  // Wait for redirect away from login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILE });
});
