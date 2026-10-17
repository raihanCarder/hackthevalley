import { test, expect, type Page } from "@playwright/test";

async function openMaya(page: Page) {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "Pain record for Maya" })).toBeVisible();
}
const pdfPages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

test("Maya's report shows the same saved evidence as the timeline, labelled synthetic and non-AI", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await openMaya(page);
  const sheet = page.locator("article");
  await expect(sheet).toContainText("Synthetic sample data. Maya is not a real patient.");
  await expect(sheet.locator("dl")).toContainText("Days with a check-in42 of 42");
  await expect(sheet.locator("dl")).toContainText("Check-ins with nothing marked4");
  const rows = sheet.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Lower back");
  await expect(rows.nth(0)).toContainText("38 of 42 recorded");
  await expect(rows.nth(1)).toContainText("Left thigh");
  await expect(rows.nth(1)).toContainText("Oct 3, 2026");
  await expect(rows.nth(2)).toContainText("Left calf");
  await expect(rows.nth(2)).toContainText("Oct 10, 2026");
  await expect(sheet).toContainText("Factual summary, not AI-generated.");
  await expect(sheet).toContainText("Burning was first recorded in the left thigh on Oct 3, 2026, and in the left calf from Oct 10, 2026.");
  await expect(sheet).toContainText("Heat pack and walking offered partial temporary relief.");
  await expect(sheet).toContainText("Range composite.");
  await expect(sheet).toContainText("It does not provide a diagnosis or treatment advice.");
  await expect(page.getByRole("button", { name: "Organize with Gemini" })).toHaveCount(0);
  await expect(sheet).toContainText("Gemini isn’t configured on this server");
  const images = sheet.locator("figure img");
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) expect(await image.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  expect(errors).toEqual([]);
});

test("changing the range recomputes counts from recorded days", async ({ page }) => {
  await openMaya(page);
  await page.getByLabel("From", { exact: true }).fill("2026-10-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-14");
  const sheet = page.locator("article");
  await expect(sheet.locator("dl")).toContainText("Days with a check-in14 of 14");
  await expect(sheet.locator("tbody tr", { hasText: "Left calf" })).toContainText("5 of 14 recorded");
  await page.getByLabel("From", { exact: true }).fill("2026-10-20");
  await expect(page.getByRole("alert").filter({ hasText: "start date must be on or before" })).toBeVisible();
});

test("visitor reports need saved check-ins and never invent content for an empty range", async ({ page }) => {
  await page.goto("/report");
  await page.getByRole("button", { name: "Your check-ins" }).click();
  await expect(page.getByRole("heading", { name: "Your check-ins aren’t connected yet" })).toBeVisible();
  await page.evaluate(() => window.localStorage.setItem("pain-journal-storage", "indexeddb"));
  await page.reload();
  await page.getByRole("button", { name: "Your check-ins" }).click();
  await expect(page.getByRole("heading", { name: /No saved check-ins between/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the check-in" })).toHaveAttribute("href", "/");
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeDisabled();
});

test("printing shows only the report and fits one A4 and one US Letter page", async ({ page }) => {
  await openMaya(page);
  await expect(page.locator("article figure img")).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.getByRole("region", { name: "Report options" })).toBeHidden();
  await expect(page.locator("article")).toBeVisible();
  await page.screenshot({ path: "test-results/report-print.png", fullPage: true });
  for (const format of ["A4", "Letter"] as const) expect(pdfPages(await page.pdf({ format, printBackground: true })), format).toBe(1);
});

test("summary API reports its status honestly and refuses cross-origin requests", async ({ request, baseURL }) => {
  const status = await (await request.get("/api/report")).json();
  expect(status.gemini.state).toBe("not-configured");
  const response = await request.post("/api/report/summary", { headers: { Origin: baseURL! }, data: { profile: "maya", from: "2026-09-06", to: "2026-10-17" } });
  expect(response.status()).toBe(200);
  const { summary } = await response.json();
  expect(summary).toMatchObject({ source: "factual", reason: "not-configured", recordedDays: 42 });
  expect(summary.sentences[0]).toBe("Check-ins were saved on all 42 calendar days in this range.");
  const empty = await request.post("/api/report/summary", { headers: { Origin: baseURL! }, data: { profile: "maya", from: "2026-11-01", to: "2026-11-02" } });
  expect(empty.status()).toBe(422);
  const foreign = await request.post("/api/report/summary", { headers: { Origin: "https://example.com" }, data: { profile: "maya", from: "2026-09-06", to: "2026-10-17" } });
  expect(foreign.status()).toBe(403);
});

test("phone layout keeps the report readable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openMaya(page);
  await expect(page.locator("article figure img")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/report-390.png", fullPage: true });
});
