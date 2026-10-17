import { test, expect } from "@playwright/test";
import { MAYA_ENTRIES } from "../../src/demo/maya";
const entry = (date: string) => ({ ...MAYA_ENTRIES[0], id: `visitor-${date}`, profileId: "visitor-test", localDate: date });

test("date-specific notes remain drafts and skipped dates stay unrecorded", async ({ page }) => {
  await page.goto("/");
  const date = page.getByLabel("Check-in date", { exact: true });
  const note = page.getByLabel("A note for this day", { exact: false });
  await expect(page.getByRole("status").filter({ hasText: "No check-in recorded" })).toBeVisible();
  await date.fill("2026-10-15");
  await note.fill("A note for the 15th");
  await expect(page.getByText("Unsaved draft", { exact: true })).toBeVisible();
  await date.fill("2026-10-17");
  await expect(note).toHaveValue("");
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
  await date.fill("2026-10-15");
  await expect(note).toHaveValue("A note for the 15th");
  await expect(page.getByRole("button", { name: "Save check-in", exact: true })).toBeEnabled();
  const count = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("pain-journal-v1");
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("entries");
      const request = tx.objectStore("entries").count();
      request.onsuccess = () => resolve(request.result);
      tx.oncomplete = () => db.close();
    };
    open.onerror = reject;
  }));
  expect(count).toBe(0);
});

test("failed server selection keeps the store explicit and preserves the browser draft", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "PostgreSQL is unavailable. Your selected store has not changed." } } }));
  await page.goto("/");
  const note = page.getByLabel("A note for this day", { exact: false });
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
  await note.fill("Keep my browser draft");
  await page.getByLabel("Save location").selectOption("postgresql");
  await expect(page.getByRole("complementary", { name: "Daily check-in" }).getByRole("alert")).toContainText("PostgreSQL is unavailable");
  await expect(page.getByLabel("Save location")).toHaveValue("postgresql");
  await page.getByLabel("Save location").selectOption("indexeddb");
  await expect(note).toHaveValue("Keep my browser draft");
  await expect(page.getByText("Unsaved draft", { exact: true })).toBeVisible();
});

test("late server reads do not replace a newer selected date", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ json: { profile: "visitor", storage: "postgresql" } }));
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/entries/*?profile=visitor", async route => {
    const date = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (date === "2026-10-15") await wait;
    const saved = { ...entry(date), note: `Saved note for ${date}` };
    await route.fulfill({ json: { entry: saved } }).catch(() => {});
  });
  await page.goto("/");
  await page.getByLabel("Save location").selectOption("postgresql");
  const date = page.getByLabel("Check-in date", { exact: true });
  const note = page.getByLabel("A note for this day", { exact: false });
  await expect(page.getByText("Saved check-in", { exact: true })).toBeVisible();
  await date.fill("2026-10-15");
  await expect(page.getByText("Opening check-in…", { exact: true })).toBeVisible();
  await date.fill("2026-10-16");
  await expect(note).toHaveValue("Saved note for 2026-10-16");
  release();
  await expect(note).toHaveValue("Saved note for 2026-10-16");
});

test("a failed PostgreSQL selection remains selected after reload", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "PostgreSQL is unavailable." } } }));
  await page.goto("/");
  await expect(page.getByLabel("Save location")).toHaveValue("indexeddb");
  await page.getByLabel("Save location").selectOption("postgresql");
  await expect(page.getByText("PostgreSQL is unavailable.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Save location")).toHaveValue("postgresql");
  await expect(page.getByText("PostgreSQL is unavailable.", { exact: true })).toBeVisible();
});

test("typing while a saved entry loads preserves the newer note as unsaved", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ json: { profile: "visitor", storage: "postgresql" } }));
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/entries/*?profile=visitor", async route => {
    await wait;
    const date = new URL(route.request().url()).pathname.split("/").at(-1)!;
    await route.fulfill({ json: { entry: { ...entry(date), note: "Older saved note" } } }).catch(() => {});
  });
  await page.goto("/");
  await expect(page.getByLabel("Save location")).toHaveValue("indexeddb");
  await page.getByLabel("Save location").selectOption("postgresql");
  await expect(page.getByText("Opening check-in…", { exact: true })).toBeVisible();
  const note = page.getByLabel("A note for this day", { exact: false });
  await note.fill("Keep this newer note");
  release();
  await expect(page.getByText("Opening check-in…", { exact: true })).not.toBeVisible();
  await expect(note).toHaveValue("Keep this newer note");
  await expect(page.getByText("Unsaved draft", { exact: true })).toBeVisible();
});

test("API rejects cross-origin writes, Maya writes, invalid dates, and unbounded lists", async ({ request, baseURL }) => {
  const external = await request.post("/api/session", { headers: { Origin: "https://elsewhere.test" } });
  expect(external.status()).toBe(403);
  const maya = await request.put("/api/entries/2026-10-17?profile=maya", { headers: { Origin: baseURL! }, data: {} });
  expect(maya.status()).toBe(403);
  const date = await request.get("/api/entries/2026-02-30");
  expect(date.status()).toBe(400);
  const range = await request.get("/api/entries?from=2020-01-01&to=2026-10-17");
  expect(range.status()).toBe(400);
  const profile = await request.get("/api/entries/2026-10-17?profile=some-other-visitor");
  expect(profile.status()).toBe(403);
  const status = await request.get("/api/status");
  const body = await status.json();
  expect(body.services.bodyMaps).toBe("Connected");
  expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  expect(JSON.stringify(body)).not.toContain("GEMINI_API_KEY");
});

test("unavailable PostgreSQL history is never labeled browser storage, empty history, or missing observations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pain-journal-storage", "postgresql"));
  await page.route("**/api/session", route => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "PostgreSQL is unavailable." } } }));
  await page.goto("/history");
  await page.getByRole("button", { name: "Visitor (My Journal)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "PostgreSQL is unavailable" })).toBeVisible();
  await expect(page.getByText("History unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Visitor records from this browser", { exact: false })).toHaveCount(0);
  await expect(page.getByText("No check-in recorded for this date.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("You have not saved any check-ins in this range yet.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await page.getByRole("button", { name: "Maya (Synthetic Demo)" }).click();
  await expect(page.getByText("38 / 42")).toBeVisible();
});
