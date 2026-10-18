import { chooseProfile } from "./profiles";
import { test, expect } from "./local-fixture";
import { MAYA_ENTRIES } from "../../src/demo/maya";
const entry = (date: string) => ({ ...MAYA_ENTRIES[0], id: `visitor-${date}`, profileId: "visitor-test", localDate: date });

test("the profile icon exposes exactly You and Maya on phone, tablet, and desktop", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/check-in");
    await expect(page.getByText("Your experience, over time.", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/saved on this device/i)).toHaveCount(0);
    const trigger = page.getByRole("button", { name: /^Switch profile, current profile/ });
    await expect(trigger).toBeEnabled();
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemradio")).toHaveCount(2);
    await page.screenshot({ path: `test-results/profile-menu-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await chooseProfile(page, "Maya");
    await expect(page.getByText("Maya’s synthetic sample, shown as recorded.", { exact: true })).toBeVisible();
    await expect(page.getByText(/fixed synthetic sample|sample data · read-only/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Paint", exact: true })).toBeDisabled();
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(trigger).toHaveAttribute("aria-label", "Switch profile, current profile Maya");
    await expect(page.getByText("38 / 42")).toBeVisible();
    await chooseProfile(page, "You");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("date-specific notes remain drafts and skipped dates stay unrecorded", async ({ page }) => {
  await page.goto("/check-in");
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
  const saved = await (await page.request.get("/api/entries/2026-10-15")).json();
  expect(saved.entry).toBeNull();
});

test("switching profiles preserves You's draft and Maya cannot be edited", async ({ page }) => {
  await page.goto("/check-in");
  const note = page.getByLabel("A note for this day", { exact: false });
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
  await note.fill("Keep my local journal draft");
  await chooseProfile(page, "Maya");
  await expect(page.getByText("Maya’s synthetic sample, shown as recorded.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save check-in", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toBeDisabled();
  const mayaWorkbench = page.locator(".body-workbench:visible");
  const mayaNote = mayaWorkbench.getByLabel("A note for this day", { exact: false });
  await expect(mayaNote).toHaveAttribute("readonly", "");
  const sampleDate = mayaWorkbench.getByLabel("Check-in date", { exact: true });
  await sampleDate.fill("2026-10-10");
  await expect(mayaNote).toHaveValue(/spread downward from my left thigh into my calf/i);
  await expect(mayaWorkbench.locator("canvas")).toHaveAttribute("data-observations", /left-calf:burning/);
  await page.screenshot({ path: "test-results/maya-check-in-workbench.png", fullPage: true });
  await chooseProfile(page, "You");
  await expect(note).toHaveValue("Keep my local journal draft");
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
  await page.goto("/check-in");
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

test("unavailable PostgreSQL stays explicit after reload and recovers", async ({ page }) => {
  await page.route("**/api/entries/*?profile=visitor", route => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "PostgreSQL is unavailable." } } }));
  await page.goto("/check-in");
  const status = page.getByRole("status").filter({ hasText: "Check-in unavailable" });
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("title", "PostgreSQL is unavailable.");
  await page.reload();
  await expect(status).toBeVisible();
  await expect(page.getByRole("button", { name: "Save check-in", exact: true })).toBeDisabled();
  await page.unroute("**/api/entries/*?profile=visitor");
  await page.reload();
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
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
  await page.goto("/check-in");
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
  expect(body.services.maya).toBe("Connected; synthetic/read-only");
  expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  expect(JSON.stringify(body)).not.toContain("GEMINI_API_KEY");
});

test("unavailable PostgreSQL history is never labeled browser storage, empty history, or missing observations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pain-journal-storage", "postgresql"));
  await page.route("**/api/entries?*", route => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "PostgreSQL is unavailable." } } }));
  await page.goto("/history");
  await chooseProfile(page, "You");
  await expect(page.getByRole("alert").filter({ hasText: "PostgreSQL is unavailable" })).toBeVisible();
  await expect(page.getByText("History unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Visitor records from this browser", { exact: false })).toHaveCount(0);
  await expect(page.getByText("No check-in recorded for this date.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("You have not saved any check-ins in this range yet.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await chooseProfile(page, "Maya");
  await expect(page.getByText("38 / 42")).toBeVisible();
});
