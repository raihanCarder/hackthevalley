import { chooseProfile } from "./profiles";
import { test, expect } from "./local-fixture";
import { MAYA_ENTRIES } from "../../src/demo/maya";

// Run explicitly against an app configured with tests/helpers/gemini-provider.mjs.
if (process.env.TEST_GEMINI_PROVIDER === "1") {
  test.skip(true, "Gemini summary controls are temporarily hidden from reports.");
  test("You's Gemini report uses PostgreSQL records and sends no browser-supplied evidence", async ({ page, request, baseURL }) => {
    await request.post("http://127.0.0.1:3199/mode/valid");
    const saved = await request.put("/api/entries/2026-10-16", { headers: { Origin: baseURL! }, data: {
      localDate: "2026-10-16", timeZone: "America/Toronto", maps: MAYA_ENTRIES[34].maps, note: "Synthetic local acceptance note.",
    } });
    expect(saved.ok()).toBeTruthy();
    await page.goto("/report?profile=visitor&from=2026-10-15&to=2026-10-17");
    await expect(page.locator("article dl")).toContainText("Days with a check-in1 of 3");
    const posted = page.waitForRequest(request => request.url().endsWith("/api/report/summary"));
    await page.getByRole("button", { name: "Generate Gemini summary" }).click();
    const body = (await posted).postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["from", "profile", "revision", "to"]);
    await expect(page.locator('[data-source="gemini"]')).toContainText("Organized by Gemini (acceptance-model)");
    await expect(page.locator("article")).toContainText("Check-ins were saved on 1 of 3 calendar days; 2 days have no check-in.");
    const stale = await request.post("/api/report/summary", { headers: { Origin: baseURL! }, data: { ...body, revision: "old revision" } });
    expect(stale.status()).toBe(409);
    const uploaded = await request.post("/api/report/summary", { headers: { Origin: baseURL! }, data: { ...body, entries: [MAYA_ENTRIES[34]] } });
    expect(uploaded.status()).toBe(400);
  });
  test("configured Gemini is explicit, validated, retryable, and falls back honestly on every provider failure", async ({ page, request }) => {
    const status = await (await request.get("http://127.0.0.1:3199/status")).json();
    await request.post("http://127.0.0.1:3199/mode/valid");
    await page.goto("/report?profile=maya");
    await expect(page.getByRole("button", { name: "Generate Gemini summary" })).toBeVisible();
    expect((await (await request.get("http://127.0.0.1:3199/status")).json()).count).toBe(status.count);
    await page.getByRole("button", { name: "Generate Gemini summary" }).click();
    await expect(page.locator('[data-source="gemini"]')).toContainText("Organized by Gemini (acceptance-model)");
    for (const [mode, reason] of [["invalid", "could not be verified"], ["diagnosis", "could not be verified"], ["error", "HTTP 503"], ["timeout", "did not respond in time"]]) {
      if (await page.getByRole("button", { name: "Use the factual summary instead" }).count()) await page.getByRole("button", { name: "Use the factual summary instead" }).click();
      await request.post(`http://127.0.0.1:3199/mode/${mode}`);
      await page.getByRole("button", { name: /^(Generate Gemini summary|Try Gemini again)$/ }).click();
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
    await page.goto("/report?profile=maya");
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/report/summary", async route => {
      await wait;
      await route.fulfill({ json: { summary: { source: "gemini", model: "STALE", sentences: ["STALE RANGE"], statements: [], recordedDays: 42 } } }).catch(() => {});
    });
    await page.getByRole("button", { name: "Generate Gemini summary" }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-10-01");
    await expect(page.locator("article dl")).toContainText("17 of 17");
    release();
    await expect(page.locator("article")).not.toContainText("STALE RANGE");
    await expect(page.locator('[data-source="factual"]')).toBeVisible();
  });

  test("switching profiles cancels an outstanding Gemini summary", async ({ page }) => {
    await page.goto("/report?profile=maya");
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/report/summary", async route => {
      await waiting;
      await route.fulfill({ json: { summary: { source: "gemini", model: "STALE MAYA", sentences: ["STALE MAYA"], statements: [], recordedDays: 42 } } }).catch(() => {});
    });
    await page.getByRole("button", { name: "Generate Gemini summary" }).click();
    await chooseProfile(page, "You");
    await expect(page.getByRole("heading", { name: /No saved check-ins between/ })).toBeVisible();
    release();
    await expect(page.locator("main")).not.toContainText("STALE MAYA");
    await expect(page.locator("article")).toHaveCount(0);
  });
}
