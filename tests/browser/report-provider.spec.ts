import { test, expect } from "@playwright/test";

// Run explicitly against an app configured with tests/helpers/gemini-provider.mjs.
if (process.env.TEST_GEMINI_PROVIDER === "1") {
  test("configured Gemini is explicit, validated, retryable, and falls back honestly on every provider failure", async ({ page, request }) => {
    const status = await (await request.get("http://127.0.0.1:3199/status")).json();
    await request.post("http://127.0.0.1:3199/mode/valid");
    await page.goto("/report");
    await expect(page.getByRole("button", { name: "Organize with Gemini" })).toBeVisible();
    expect((await (await request.get("http://127.0.0.1:3199/status")).json()).count).toBe(status.count);
    await page.getByRole("button", { name: "Organize with Gemini" }).click();
    await expect(page.locator('[data-source="gemini"]')).toContainText("Organized by Gemini (acceptance-model)");
    for (const [mode, reason] of [["invalid", "could not be verified"], ["diagnosis", "could not be verified"], ["error", "HTTP 503"], ["timeout", "did not respond in time"]]) {
      if (await page.getByRole("button", { name: "Use the factual summary instead" }).count()) await page.getByRole("button", { name: "Use the factual summary instead" }).click();
      await request.post(`http://127.0.0.1:3199/mode/${mode}`);
      await page.getByRole("button", { name: /^(Organize with Gemini|Try Gemini again)$/ }).click();
      await expect(page.locator('[data-source="factual"]')).toContainText("not AI-generated");
      await expect(page.getByRole("status").filter({ hasText: "Gemini summary unavailable" })).toContainText(reason);
      await expect(page.getByRole("button", { name: "Try Gemini again" })).toBeVisible();
      await expect(page.locator("article tbody tr")).toHaveCount(3);
    }
    await request.post("http://127.0.0.1:3199/mode/valid");
    await page.getByRole("button", { name: "Try Gemini again" }).click();
    await expect(page.locator('[data-source="gemini"]')).toBeVisible();
  });

  test("late summary responses cannot replace the evidence of a newer report range", async ({ page }) => {
    await page.goto("/report");
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/report/summary", async route => {
      await wait;
      await route.fulfill({ json: { summary: { source: "gemini", model: "STALE", sentences: ["STALE RANGE"], statements: [], recordedDays: 42 } } }).catch(() => {});
    });
    await page.getByRole("button", { name: "Organize with Gemini" }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-10-01");
    await expect(page.locator("article dl")).toContainText("17 of 17");
    release();
    await expect(page.locator("article")).not.toContainText("STALE RANGE");
    await expect(page.locator('[data-source="factual"]')).toBeVisible();
  });
}
