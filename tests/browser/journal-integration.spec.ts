import { test, expect, type Page } from "@playwright/test";
import { landmark } from "./body-landmarks";

// Named views stand 2.9 m from the orbit target (0, 1, 0) with a 40° vertical field of view.
async function paintFront(page: Page, from: [number, number, number], to: [number, number, number]) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const screen = ([x, y, z]: [number, number, number]): [number, number] => {
    const t = Math.tan(20 * Math.PI / 180), depth = 2.9 - z;
    return [box.x + (x / (depth * t * (box.width / box.height)) + 1) / 2 * box.width, box.y + (1 - (y - 1) / (depth * t)) / 2 * box.height];
  };
  await page.mouse.move(...screen(from));
  await page.mouse.down();
  await page.mouse.move(...screen(to), { steps: 12 });
  await page.mouse.up();
}
const observations = (page: Page) => page.locator("canvas").getAttribute("data-observations");

test("a painted check-in saves to the browser, restores exactly after reload, and appears in the visitor report", async ({ page }) => {
  await page.goto("/check-in");
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
  const date = page.getByLabel("Check-in date", { exact: true });
  await date.fill("2026-10-16");
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Check-in", exact: true }).click();
  await page.locator("label", { hasText: "Burning" }).click();
  await paintFront(page, landmark("left-thigh-upper"), landmark("left-thigh-lower"));
  await expect.poll(() => observations(page)).toContain("left-thigh:burning");
  const painted = await observations(page);
  await page.getByRole("button", { name: "Check-in details", exact: true }).click();
  await expect(page.getByText("Unsaved draft", { exact: true })).toBeVisible();
  await page.getByLabel("A note for this day", { exact: false }).fill("Thigh burned after the long drive. Walking helped a little.");
  await page.getByRole("button", { name: "Save check-in", exact: true }).click();
  await expect(page.getByText("Saved check-in", { exact: true })).toBeVisible();

  // Another date starts blank and stays unrecorded; returning restores the saved map exactly.
  await date.fill("2026-10-15");
  await expect(page.getByText("No check-in recorded", { exact: true })).toBeVisible();
  await expect.poll(() => observations(page)).toBe("");
  await page.reload();
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await page.getByLabel("Check-in date", { exact: true }).fill("2026-10-16");
  await expect(page.getByText("Saved check-in", { exact: true })).toBeVisible();
  await expect.poll(() => observations(page)).toBe(painted);
  await expect(page.getByLabel("A note for this day", { exact: false })).toHaveValue("Thigh burned after the long drive. Walking helped a little.");

  // The report reads the same saved entry (not the editor draft).
  await page.goto("/report");
  await page.getByRole("button", { name: "Your check-ins" }).click();
  await page.getByLabel("From", { exact: true }).fill("2026-10-10");
  await page.getByLabel("To", { exact: true }).fill("2026-10-16");
  const sheet = page.locator("article");
  await expect(sheet.locator("dl")).toContainText("Days with a check-in1 of 7");
  await expect(sheet.locator("tbody tr")).toHaveCount(1);
  await expect(sheet.locator("tbody tr")).toContainText("Left thigh");
  await expect(sheet).toContainText("Walking helped a little.");
  await expect(sheet.locator("figure img")).toHaveCount(2);
});

test("model and details tabs preserve the same live editor and unsaved note", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  const created = await page.evaluate(() => (globalThis as unknown as { __painJournalBodyScenes: { created: number } }).__painJournalBodyScenes.created);
  const selectedControl = page.getByRole("group", { name: "Body map tools", exact: true }).locator('[aria-pressed="true"]');
  await expect(page.getByRole("link", { name: "Check-in details", exact: true })).toHaveCount(0);
  await expect(selectedControl).toHaveText("Rotate");
  await page.locator("label", { hasText: "Burning" }).click();
  await paintFront(page, landmark("left-thigh-upper"), landmark("left-thigh-lower"));
  const painted = await observations(page);
  expect(painted).toContain("left-thigh:burning");
  await expect(selectedControl).toHaveText("Paint");
  await page.getByRole("button", { name: "Body", exact: true }).click();
  await expect(selectedControl).toHaveText("Body");
  await expect(page.getByRole("region", { name: "Body shape", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Brush controls", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Check-in details", exact: true }).click();
  await expect(selectedControl).toHaveText("Check-in details");
  await page.getByRole("button", { name: "Check-in details", exact: true }).click();
  await expect(selectedControl).toHaveText("Check-in details");
  await expect(page.locator("canvas")).toBeVisible();
  const note = page.getByLabel("A note for this day", { exact: false });
  await expect(page.getByRole("link", { name: "Check-in", exact: true })).toHaveAttribute("aria-current", "page");
  await note.fill("Keep this note while I return to the body.");
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Daily check-in" })).toBeHidden();
  expect(await observations(page)).toBe(painted);
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Check-in details", exact: true }).click();
  await expect(note).toHaveValue("Keep this note while I return to the body.");
  await expect(page.getByText("Unsaved draft", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (globalThis as unknown as { __painJournalBodyScenes: { created: number } }).__painJournalBodyScenes.created)).toBe(created);
});

test("Maya's records are served read-only through the journal API", async ({ request, baseURL }) => {
  const list = await request.get("/api/entries?profile=maya&from=2026-10-01&to=2026-10-17");
  expect(list.status()).toBe(200);
  const { entries } = await list.json();
  expect(entries).toHaveLength(17);
  expect(entries[0]).not.toHaveProperty("maps");
  const day = await (await request.get("/api/entries/2026-10-10?profile=maya")).json();
  expect(day.entry.observations.map((o: { regionId: string }) => o.regionId)).toContain("left-calf");
  const previous = await (await request.get("/api/entries/previous?profile=maya&before=2026-09-06")).json();
  expect(previous.entry).toBeNull();
  const write = await request.put("/api/entries/2026-10-17?profile=maya", { headers: { Origin: baseURL! }, data: {} });
  expect(write.status()).toBe(403);
});
