import { test, expect, type Page } from "@playwright/test";
import { landmark, project } from "./body-landmarks";

const storage = process.env.TEST_JOURNAL_STORAGE === "postgresql" ? "postgresql" : "indexeddb";
async function ready(page: Page) {
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await expect(page.getByRole("button", { name: "Save check-in", exact: true })).toBeEnabled();
}
async function paintCalf(page: Page) {
  await page.getByRole("link", { name: "Check-in", exact: true }).click();
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // Stroke down the front of the patient's left calf, between two surface landmarks of the body asset.
  const [x0, y0] = project(box, landmark("left-calf-upper")), [x1, y1] = project(box, landmark("left-calf-lower"));
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const client = await page.context().newCDPSession(page);
    const point = (i: number) => [{ x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10, id: 1 }];
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(0) });
    for (let i = 1; i <= 10; i++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(i) });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 10 }); await page.mouse.up();
  }
  await expect(canvas).toHaveAttribute("data-observations", /left-calf:aching/);
  await page.getByRole("button", { name: "Check-in details", exact: true }).click();
}
async function fingerprints(page: Page) {
  await expect(page.locator("canvas").first()).toHaveAttribute("data-revision", /\d+/);
  return page.evaluate(async () => {
    const handles = (globalThis as unknown as { __painJournalBodyScenes: { handles: Set<{ snapshot(): Record<string, Uint8Array> }> } }).__painJournalBodyScenes.handles;
    const layers = [...handles][0].snapshot();
    return Promise.all(Object.values(layers).map(async layer => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", layer as Uint8Array<ArrayBuffer>))).join(",")));
  });
}
async function save(page: Page) {
  await page.getByRole("button", { name: /^(Save check-in|Retry saving check-in)$/ }).click();
  await expect(page.getByText("Saved check-in", { exact: true })).toBeVisible();
}

async function assembledJournal(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/check-in");
  await page.getByLabel("Save location").selectOption(storage);
  await ready(page);
  const date = page.getByLabel("Check-in date", { exact: true });
  const note = page.getByLabel("A note for this day", { exact: false });
  await date.fill("2026-10-15");
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
  await paintCalf(page);
  await note.fill("Walking offered partial relief.");
  const original = await fingerprints(page);
  await save(page); await page.reload(); await ready(page);
  await page.getByLabel("Check-in date", { exact: true }).fill("2026-10-15");
  await expect(note).toHaveValue("Walking offered partial relief.");
  expect(await fingerprints(page)).toEqual(original);
  await note.fill("Updated saved context."); await save(page);
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Visitor (My Journal)" }).click();
  await page.getByLabel("History from").fill("2026-10-15");
  await expect(page.getByRole("button", { name: "Play timeline playback" })).toBeDisabled();
  await page.getByRole("slider", { name: "Scrub calendar dates" }).fill("0");
  await expect(page.getByText("Updated saved context.", { exact: true })).toBeVisible();
  expect(await fingerprints(page)).toEqual(original);
  await page.getByRole("button", { name: "Maya (Synthetic Demo)" }).click();
  await page.getByRole("button", { name: "Visitor (My Journal)" }).click();
  await expect(page.locator("[data-history-root]")).toHaveAttribute("data-selected-date", "2026-10-15");
  await expect(page.getByText("Updated saved context.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Check-in", exact: true }).click();
  await page.getByRole("button", { name: "Check-in details", exact: true }).click(); await ready(page);
  // Copy over a skipped date, edit and save within the usability target.
  const started = Date.now();
  await date.fill("2026-10-17");
  await page.getByRole("button", { name: "Copy previous map" }).click();
  await expect(page.getByText(/Map copied from 2026-10-15/)).toBeVisible();
  expect(await fingerprints(page)).toEqual(original);
  await note.fill("Copied check-in; heat helped a little."); await save(page);
  const elapsed = Date.now() - started;
  test.info().annotations.push({ type: "previous-map edit", description: `${elapsed} ms (automated interaction)` });
  expect(elapsed).toBeLessThan(30_000);
  await date.fill("2026-10-18");
  await page.getByRole("button", { name: "Start with an empty map" }).click(); await save(page);
  // An unsaved date must not appear in the report.
  await date.fill("2026-10-19"); await note.fill("UNSAVED DRAFT MUST NOT APPEAR");
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Visitor (My Journal)" }).click();
  await page.getByLabel("History to").fill("2026-10-19");
  await page.getByLabel("History from").fill("2026-10-15");
  await expect(page.getByText("0 / 3", { exact: true })).toBeVisible(); // selected lower back has no marks
  const slider = page.getByRole("slider", { name: "Scrub calendar dates" });
  await slider.fill("0");
  await expect(page.getByText("Updated saved context.", { exact: true })).toBeVisible();
  expect(await fingerprints(page)).toEqual(original);
  await slider.fill("1");
  await expect(page.getByText("No check-in recorded for this date.", { exact: true })).toBeVisible();
  await slider.fill("3");
  await expect(page.getByText("Explicitly empty check-in")).toBeVisible();
  await page.getByRole("tab", { name: "Compare Dates" }).click();
  await page.getByLabel("Earlier Date (A)").selectOption("2026-10-15");
  await page.getByLabel("Later Date (B)").selectOption("2026-10-18");
  await expect(page.getByRole("region", { name: "Saved map comparison" })).toContainText("no longer marked");
  await page.getByRole("link", { name: "Appointment report", exact: true }).click();
  await page.getByRole("button", { name: "Your check-ins" }).click();
  await page.getByLabel("To", { exact: true }).fill("2026-10-19");
  await page.getByLabel("From", { exact: true }).fill("2026-10-15");
  await expect(page.locator("article dl")).toContainText("Days with a check-in3 of 5");
  await expect(page.locator("article dl")).toContainText("Days without a check-in2");
  await expect(page.locator("article")).not.toContainText("UNSAVED DRAFT MUST NOT APPEAR");
  await expect(page.locator("article figure img")).toHaveCount(2);
  expect(errors).toEqual([]);
}

test(`assembled ${storage} painting, exact reload, copy, missing/empty history, comparison and saved-only report`, async ({ page }) => assembledJournal(page));
test.describe("narrow touch integration", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 900 } });
  test(`touch painting through ${storage} history, comparison and report`, async ({ page }) => {
    await assembledJournal(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/assembled-${storage}-390.png`, fullPage: true });
  });
});


test("a rejected browser write preserves the real painted draft and retries in the same store", async ({ page }) => {
  await page.goto("/check-in"); await page.getByLabel("Save location").selectOption("indexeddb"); await ready(page);
  await paintCalf(page);
  await page.getByLabel("A note for this day", { exact: false }).fill("Keep this note and painting.");
  const before = await fingerprints(page);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      if (args[1] === "readwrite") throw new DOMException("Test quota rejection", "QuotaExceededError");
      return original.apply(this, args);
    };
    (window as unknown as { restoreTransaction: () => void }).restoreTransaction = () => { IDBDatabase.prototype.transaction = original; };
  });
  await page.getByRole("button", { name: "Save check-in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your draft is still here" })).toBeVisible();
  expect(await fingerprints(page)).toEqual(before);
  await expect(page.getByLabel("Save location")).toHaveValue("indexeddb");
  await page.evaluate(() => (window as unknown as { restoreTransaction: () => void }).restoreTransaction());
  await save(page);
  await page.reload(); await ready(page);
  expect(await fingerprints(page)).toEqual(before);
  await expect(page.getByLabel("A note for this day", { exact: false })).toHaveValue("Keep this note and painting.");
});

if (storage === "postgresql") {
  test("server sessions isolate real saved maps and rejected server writes retain the draft", async ({ page, browser, baseURL }) => {
    await page.goto("/check-in"); await page.getByLabel("Save location").selectOption("postgresql"); await ready(page);
    await page.getByLabel("Check-in date", { exact: true }).fill("2026-10-14");
    await paintCalf(page);
    const before = await fingerprints(page);
    await page.getByLabel("A note for this day", { exact: false }).fill("Server retry note");
    await page.route("**/api/entries/2026-10-14", route => route.request().method() === "PUT"
      ? route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Database write rejected" } } }) : route.continue());
    await page.getByRole("button", { name: "Save check-in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your draft is still here" })).toBeVisible();
    await expect(page.getByLabel("Save location")).toHaveValue("postgresql");
    expect(await fingerprints(page)).toEqual(before);
    await page.unroute("**/api/entries/2026-10-14"); await save(page);
    const saved = await (await page.request.get(`${baseURL}/api/entries/2026-10-14`)).json();
    expect(saved.entry.observations.length).toBeGreaterThan(0);
    const other = await browser.newContext();
    try {
      expect((await other.request.post(`${baseURL}/api/session`, { headers: { Origin: baseURL! } })).ok()).toBeTruthy();
      expect(await (await other.request.get(`${baseURL}/api/entries/2026-10-14`)).json()).toEqual({ entry: null });
      const otherWrite = await other.request.put(`${baseURL}/api/entries/2026-10-14`, { headers: { Origin: baseURL! }, data: { localDate: "2026-10-14", timeZone: saved.entry.timeZone, maps: saved.entry.maps, note: "Other visitor" } });
      expect(otherWrite.ok()).toBeTruthy();
      const unchanged = await (await page.request.get(`${baseURL}/api/entries/2026-10-14`)).json();
      expect(unchanged.entry.note).toBe("Server retry note");
      expect((await (await otherWrite.json()).entry).profileId).not.toBe(saved.entry.profileId);
    } finally { await other.close(); }
  });
}
