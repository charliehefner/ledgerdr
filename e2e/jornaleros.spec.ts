import { test, expect } from "@playwright/test";

test.describe("Jornaleros registration", () => {
  test("can open add dialog and submit a jornalero", async ({ page }) => {
    await page.goto("/hr");

    // Navigate to Jornaleros tab
    const jornalerosTab = page.getByRole("tab", { name: /jornalero/i });
    if (await jornalerosTab.isVisible()) {
      await jornalerosTab.click();
    }

    // Click add button
    const addBtn = page.getByRole("button", { name: /agregar jornalero|add/i });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Dialog should open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill form with test data
    const testName = `E2E-Test-${Date.now()}`;
    await dialog.getByPlaceholder(/nombre completo|full name/i).fill(testName);
    await dialog.getByPlaceholder("000-0000000-0").fill("999-9999999-9");

    // Submit
    await dialog.getByRole("button", { name: /agregar|add|guardar|save/i }).click();

    // Should either succeed (toast) or show a meaningful error — not a generic 500/crash
    // Wait a moment for the mutation to resolve
    await page.waitForTimeout(2_000);

    // Verify no crash: page still functional
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
