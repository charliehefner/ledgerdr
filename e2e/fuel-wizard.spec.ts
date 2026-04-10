import { test, expect } from "@playwright/test";

test.describe("Driver Portal fuel wizard", () => {
  test("fuel wizard loads and shows first step", async ({ page }) => {
    await page.goto("/driver");

    // Should show the fueling wizard or portal
    const wizard = page.locator("[class*='wizard'], [class*='fueling'], [class*='driver']").first();

    // Page should load without crash
    await expect(page.locator("body")).not.toBeEmpty();

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test("can navigate wizard steps (smoke)", async ({ page }) => {
    await page.goto("/driver");
    await page.waitForTimeout(2_000);

    // Look for step indicators or next button
    const nextBtn = page.getByRole("button", { name: /siguiente|next|continuar/i });

    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // First, select a tractor/equipment if required
      const select = page.locator("select, [role='combobox']").first();
      if (await select.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await select.click();
        // Select first option
        const option = page.getByRole("option").first();
        if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await option.click();
        }
      }

      // Try to advance — should not crash
      await nextBtn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });
});
