import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated

  test("shows login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /iniciar|sign in|login/i })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/correo|email/i).fill("fake@invalid.com");
    await page.getByPlaceholder(/contraseña|password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /iniciar|sign in|login/i }).click();

    // Should show an error toast or stay on login
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
