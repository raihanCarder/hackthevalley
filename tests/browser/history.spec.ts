import { test, expect } from "@playwright/test";

test("history page loads with Maya synthetic profile, scrubber, and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/history");

  // Verify page header
  await expect(page.locator("h1")).toContainText("A picture over time");

  // Verify Maya profile is active and labeled synthetic
  await expect(page.getByText("Synthetic · Read-only")).toBeVisible();
  await expect(page.locator("input[type=range]")).toBeVisible();

  // Verify default date shows October 17, 2026
  await expect(page.locator(".timelineContainer")).toContainText("October 17, 2026");

  // Verify observations for Oct 17 are visible
  await expect(page.getByText("Lower Back: Aching / dull")).toBeVisible();
  await expect(page.getByText("Left Thigh: Burning")).toBeVisible();
  await expect(page.getByText("Left Calf: Burning")).toBeVisible();

  expect(errors).toEqual([]);
});

test("date scrubbing updates notes and regional observations faithfully", async ({ page }) => {
  await page.goto("/history");

  // Scrub to an early empty day (e.g., September 6, 2026 - index 0)
  const slider = page.locator("input[type=range]");
  await slider.fill("0");

  await expect(page.locator(".timelineContainer")).toContainText("September 6, 2026");
  await expect(page.getByText("Explicitly empty check-in")).toBeVisible();
  await expect(page.getByText("Feeling good today after a long morning walk")).toBeVisible();

  // Scrub to October 3 (onset of thigh burning - index 27)
  await slider.fill("27");
  await expect(page.locator(".timelineContainer")).toContainText("October 3, 2026");
  await expect(page.getByText("New sensation today: burning feeling appeared")).toBeVisible();
  await expect(page.getByText("Left Thigh: Burning")).toBeVisible();
  // Calf should NOT be present on Oct 3
  await expect(page.getByText("Left Calf: Burning")).toHaveCount(0);
});

test("regional trends tab displays accurate frequency and SVG chart", async ({ page }) => {
  await page.goto("/history");

  // Default region is lower back, aching
  await expect(page.getByText("Recorded-Day Frequency (90.5%)")).toBeVisible();
  await expect(page.getByText("38 / 42")).toBeVisible();

  // SVG trend chart is present and accessible
  const chartSvg = page.locator("svg[role=img][aria-label*='trend chart']");
  await expect(chartSvg).toBeVisible();

  // Switch region to Left Thigh and burning
  await page.locator("#trend-region-select").selectOption("left-thigh");
  await page.locator("#trend-pain-select").selectOption("burning");

  await expect(page.getByText("15 / 42")).toBeVisible();
  await expect(page.getByText("Recorded-Day Frequency (35.7%)")).toBeVisible();
  await expect(page.getByText("First Recorded Presence")).toBeVisible();
});

test("date comparison accurately highlights newly marked regions", async ({ page }) => {
  await page.goto("/history");

  // Click Compare Dates tab
  await page.getByRole("tab", { name: "Compare Dates" }).click();

  // Click Thigh Onset preset (Oct 2 vs Oct 3)
  await page.getByRole("button", { name: "Thigh Onset (Oct 2 vs Oct 3)" }).click();

  await expect(page.getByText("Newly Marked Pain Regions on 2026-10-03")).toBeVisible();
  await expect(page.getByText("Left Thigh: Burning")).toBeVisible();
  await expect(page.getByText("Left Thigh burning newly recorded on 2026-10-03")).toBeVisible();

  // Click Calf Spread preset (Oct 3 vs Oct 10)
  await page.getByRole("button", { name: "Calf Spread (Oct 3 vs Oct 10)" }).click();

  await expect(page.getByText("Newly Marked Pain Regions on 2026-10-10")).toBeVisible();
  await expect(page.getByText("Left Calf: Burning")).toBeVisible();
  await expect(page.getByText("Left Calf burning newly recorded on 2026-10-10")).toBeVisible();
});

test("switching to visitor profile displays clean empty state without leaking Maya data", async ({ page }) => {
  await page.goto("/history");

  // Switch to Visitor
  await page.getByRole("button", { name: "Visitor (My Journal)" }).click();

  await expect(page.getByText("Local Session")).toBeVisible();
  await expect(page.getByText("You have not saved any check-ins in this session yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to 3D check-in to paint pain" })).toBeVisible();
  await expect(page.getByText("Playback disabled")).toBeVisible();

  // Switch back to Maya restores Maya
  await page.getByRole("button", { name: "Maya (Synthetic Demo)" }).click();
  await expect(page.getByText("Synthetic · Read-only")).toBeVisible();
  await expect(page.getByText("38 / 42")).toBeVisible();
});

test("history layout is responsive across mobile, tablet, and desktop without overflow", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/history");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
