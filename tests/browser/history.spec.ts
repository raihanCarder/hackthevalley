import { chooseProfile } from "./profiles";
import { test, expect } from "./local-fixture";

test("history page loads with Maya synthetic profile, scrubber, and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/history?profile=maya");

  // Verify page header
  await expect(page.locator("h1")).toContainText("A picture over time");

  // Verify Maya profile is active and labeled synthetic
  await expect(page.getByText("Maya · Synthetic sample · Six weeks of check-ins.", { exact: true })).toBeVisible();
  await expect(page.locator("input[type=range]")).toBeVisible();

  // Verify default date shows Oct 17, 2026
  await expect(page.locator("[data-history-root]")).toContainText("Oct 17, 2026");

  // Verify observations for Oct 17 are visible
  await expect(page.getByText("Lower Back: Aching / dull")).toBeVisible();
  await expect(page.getByText("Left Thigh: Burning")).toBeVisible();
  await expect(page.getByText("Left Calf: Burning")).toBeVisible();

  expect(errors).toEqual([]);
});

test("date scrubbing updates notes and regional observations faithfully", async ({ page }) => {
  await page.goto("/history?profile=maya");

  // Scrub to an early empty day (e.g., Sep 6, 2026 - index 0)
  const slider = page.locator("input[type=range]");
  await slider.fill("0");

  await expect(page.locator("[data-history-root]")).toContainText("Sep 6, 2026");
  await expect(page.getByText("Explicitly empty check-in")).toBeVisible();
  await expect(page.getByText("Feeling good today after a long morning walk")).toBeVisible();

  // Scrub to October 3 (onset of thigh burning - index 27)
  await slider.fill("27");
  await expect(page.locator("[data-history-root]")).toContainText("Oct 3, 2026");
  await expect(page.getByText("New sensation today: burning feeling appeared")).toBeVisible();
  await expect(page.getByText("Left Thigh: Burning")).toBeVisible();
  // Calf should NOT be present on Oct 3
  await expect(page.getByText("Left Calf: Burning")).toHaveCount(0);
});

test("regional trends tab displays accurate frequency and SVG chart", async ({ page }) => {
  await page.goto("/history?profile=maya");

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
  await page.goto("/history?profile=maya");

  // Click Compare Dates tab
  await page.getByRole("tab", { name: "Compare Dates" }).click();

  // Click Thigh Onset preset (Oct 2 vs Oct 3)
  await page.getByRole("button", { name: "Thigh Onset (Oct 2 vs Oct 3)" }).click();

  await expect(page.getByText("Newly Marked Pain Regions on 2026-10-03")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Left Thigh: Burning")).toBeVisible();
  await expect(page.getByText("Left Thigh burning newly recorded on 2026-10-03")).toBeVisible();

  // Click Calf Spread preset (Oct 3 vs Oct 10)
  await page.getByRole("button", { name: "Calf Spread (Oct 3 vs Oct 10)" }).click();

  await expect(page.getByText("Newly Marked Pain Regions on 2026-10-10")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Left Calf: Burning")).toBeVisible();
  await expect(page.getByText("Left Calf burning newly recorded on 2026-10-10")).toBeVisible();
});

test("switching to visitor profile displays clean empty state without leaking Maya data", async ({ page }) => {
  await page.goto("/history?profile=maya");

  // Switch to Visitor
  await chooseProfile(page, "You");

  await expect(page.getByText("Your saved check-ins from PostgreSQL on this device.", { exact: true })).toBeVisible();
  await expect(page.getByText("You have not saved any check-ins in this range yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to 3D check-in to paint pain" })).toBeVisible();
  await expect(page.getByText("Playback disabled")).toBeVisible();

  // Switch back to Maya restores Maya
  await chooseProfile(page, "Maya");
  await expect(page.getByText("Maya · Synthetic sample · Six weeks of check-ins.", { exact: true })).toBeVisible();
  await expect(page.getByText("38 / 42")).toBeVisible();
});

test("history layout is responsive across mobile, tablet, and desktop without overflow", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/history?profile=maya");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator("canvas").first()).toHaveAttribute("data-revision", /\d+/);
    await page.screenshot({ path: `test-results/history-${width}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Compare Dates" }).click();
    await expect(page.getByRole("region", { name: "Saved map comparison" }).locator("canvas")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/comparison-${width}.png`, fullPage: true });
  }
});

test("Maya plays all 42 dates chronologically, stops at the end, and scrubbing cancels playback", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/history?profile=maya");
  const slider = page.getByRole("slider", { name: "Scrub calendar dates" });
  await slider.fill("0");
  await expect(page.getByText("Explicitly empty check-in")).toBeVisible();
  await page.evaluate(() => {
    const root = document.querySelector("[data-history-root]")!;
    const dates = [root.getAttribute("data-selected-date")];
    (window as unknown as { observedDates: (string | null)[] }).observedDates = dates;
    new MutationObserver(() => { dates.push(root.getAttribute("data-selected-date")); }).observe(root, { attributes: true, attributeFilter: ["data-selected-date"] });
  });
  await page.getByRole("button", { name: "2x", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline playback" }).click();
  await expect(page.locator("[data-history-root]")).toHaveAttribute("data-selected-date", "2026-10-17", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Play timeline playback" })).toBeVisible();
  await expect(page.getByText("Left Calf: Burning")).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute("data-observations", /left-calf:burning/);
  const dates = await page.evaluate(() => (window as unknown as { observedDates: string[] }).observedDates);
  expect(dates).toHaveLength(42);
  expect(dates).toEqual([...dates].sort());
  await page.getByRole("button", { name: "Play timeline playback" }).click();
  await slider.fill("27");
  await expect(page.getByText("New sensation today: burning feeling appeared")).toBeVisible();
  await page.waitForTimeout(700);
  await expect(slider).toHaveValue("27");
  await expect(page.locator("canvas")).toHaveAttribute("data-observations", /left-thigh:burning/);
  await expect(page.locator("canvas")).not.toHaveAttribute("data-observations", /left-calf:burning/);
});
