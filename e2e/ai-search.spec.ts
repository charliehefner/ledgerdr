import { test, expect } from "@playwright/test";

test.describe("AI Search", () => {
  test("can type a query and get a response", async ({ page }) => {
    await page.goto("/dashboard");

    // Find the AI search input
    const searchInput = page.getByPlaceholder(/pregunta con ia|ai search/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Type a query
    await searchInput.fill("¿Cuántos empleados activos hay?");
    await searchInput.press("Enter");

    // Dialog should open with loading or result
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Wait for response (loading spinner disappears, answer appears)
    const answer = dialog.locator(".whitespace-pre-wrap, .prose");
    await expect(answer).toBeVisible({ timeout: 30_000 });

    // Answer should have meaningful content (not empty)
    const text = await answer.textContent();
    expect(text && text.length > 10).toBeTruthy();
  });
});
