import { test, expect } from "./local-fixture";
import { chooseProfile } from "./profiles";
import { MAYA_ENTRIES } from "../../src/demo/maya";
import { PAIN_LABELS, REGION_IDS, type DailyEntry } from "../../src/domain/contracts";
import { regionPhrase } from "../../src/report/facts";
import { formatDate } from "../../src/report/plan";

const logsSelector = "[data-check-in-log]";
const longNote = `${"Walking and sitting felt different today. ".repeat(12)}\n\nSecond paragraph with <script>patient text</script>, kept as written.`;

test("Logs includes all Maya dates, full notes, and saved regional measurements", async ({ page }) => {
  await page.goto("/report?profile=maya");
  const logs = page.getByRole("region", { name: "Logs", exact: true });
  await expect(logs.locator("[data-log-page]").nth(1)).toBeAttached();
  await expect(logs).toContainText("Maya · Synthetic sample");
  await expect(logs.locator(logsSelector)).toHaveCount(42);
  expect(await logs.locator("time").evaluateAll(elements => elements.map(element => element.getAttribute("datetime"))))
    .toEqual(MAYA_ENTRIES.map(entry => entry.localDate));
  for (const entry of MAYA_ENTRIES) {
    const log = logs.locator(`[data-check-in-log="${entry.localDate}"]`);
    await expect(log.getByRole("heading", { name: formatDate(entry.localDate), exact: true })).toBeVisible();
    if (entry.note?.trim()) expect(await log.locator("[class*=logNoteText]").textContent()).toBe(entry.note);
    else await expect(log).toContainText("No written note.");
    await expect(log.locator("tbody tr")).toHaveCount(entry.observations.length);
    if (!entry.observations.length) await expect(log).toContainText("Nothing marked");
    for (const [index, observation] of entry.observations.entries()) {
      const cells = await log.locator("tbody tr").nth(index).locator("th, td").allTextContents();
      expect(cells).toEqual([
        capitalize(regionPhrase(observation.regionId)), PAIN_LABELS[observation.painType],
        `${Math.round(observation.meanIntensity * 10) / 10} / 10`, `${Math.round(observation.peakIntensity * 10) / 10} / 10`,
        `${Math.round(observation.mapCoverage * 100)}%`,
      ]);
    }
  }
});

test("saved empty maps, missing dates, absent notes, and refreshed notes stay distinct", async ({ page, request, baseURL }) => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires npm run test:local-browser and its disposable database schema.");
  const headers = { Origin: baseURL! };
  const save = async (date: string, maps: DailyEntry["maps"], note?: string) => {
    const response = await request.put(`/api/entries/${date}`, { headers, data: { localDate: date, timeZone: "America/Toronto", maps, note } });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).entry as DailyEntry;
  };
  const marked = await save("2026-10-01", MAYA_ENTRIES[40].maps, longNote);
  expect(marked.observations.length).toBeGreaterThan(1);
  const empty = MAYA_ENTRIES.find(entry => !entry.observations.length)!;
  await save("2026-10-02", empty.maps, "A saved empty map still has my note.");
  await save("2026-10-04", empty.maps);
  await page.goto("/report?profile=visitor&from=2026-10-01&to=2026-10-04");
  const logs = page.getByRole("region", { name: "Logs", exact: true });
  await expect(page.locator("[data-report-summary] dl")).toContainText("Days with a check-in3 of 4");
  await expect(page.locator("[data-report-summary] dl")).toContainText("Days without a check-in1");
  await expect(logs.locator(logsSelector)).toHaveCount(3);
  const first = logs.locator('[data-check-in-log="2026-10-01"]');
  expect(await first.locator("[class*=logNoteText]").textContent()).toBe(longNote);
  await expect(first.locator("[class*=logNoteText]")).toHaveCSS("white-space", "pre-wrap");
  await expect(first.locator("script")).toHaveCount(0);
  await expect(first.locator("tbody tr")).toHaveCount(marked.observations.length);
  await expect(logs.locator('[data-check-in-log="2026-10-02"]')).toContainText("Nothing marked");
  await expect(logs.locator('[data-check-in-log="2026-10-02"]')).toContainText("A saved empty map still has my note.");
  await expect(logs.locator('[data-check-in-log="2026-10-03"]')).toHaveCount(0);
  await expect(logs.locator('[data-check-in-log="2026-10-04"]')).toContainText("No written note.");

  await save("2026-10-01", marked.maps, "Updated saved note.");
  await page.getByRole("button", { name: "Refresh report", exact: true }).click();
  await expect(first).toContainText("Updated saved note.");
  await expect(first).not.toContainText("Walking and sitting");
  await expect(page.locator("[data-report-summary]")).toContainText("Updated saved note.");

  await chooseProfile(page, "Maya");
  await expect(logs).toContainText("Maya · Synthetic sample");
  await expect(logs).not.toContainText("Updated saved note.");
  await chooseProfile(page, "You");
  await page.getByLabel("From", { exact: true }).fill("2026-10-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-04");
  await expect(logs.locator(logsSelector)).toHaveCount(3);
  await expect(logs).not.toContainText("Synthetic sample");
});

test("range boundaries update Logs with the summary and empty ranges have no logs", async ({ page }) => {
  await page.goto("/report?profile=maya");
  await expect(page.locator(logsSelector)).toHaveCount(42);
  await page.getByLabel("From", { exact: true }).fill("2026-10-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-14");
  await expect(page.locator(logsSelector)).toHaveCount(14);
  expect(await page.locator(`${logsSelector} time`).evaluateAll(elements => elements.map(element => element.getAttribute("datetime"))))
    .toEqual(MAYA_ENTRIES.filter(entry => entry.localDate >= "2026-10-01" && entry.localDate <= "2026-10-14").map(entry => entry.localDate));
  await expect(page.locator("[data-report-summary] dl")).toContainText("14 of 14");
  await page.getByLabel("To", { exact: true }).fill("2026-11-02");
  await page.getByLabel("From", { exact: true }).fill("2026-11-01");
  await expect(page.getByRole("heading", { name: "No check-ins in this date range" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Logs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeDisabled();
});

test("long notes and many observations flow through PDF pages and wrap on phones", async ({ page }, testInfo) => {
  // Intercept the read endpoint for an oversized layout fixture without writing synthetic measurements into PostgreSQL.
  const entry = structuredClone(MAYA_ENTRIES[40]);
  entry.id = "oversized-layout-fixture";
  entry.profileId = "local-you";
  entry.localDate = "2026-10-01" as DailyEntry["localDate"];
  entry.note = Array.from({ length: 20 }, (_, index) => `Paragraph ${index + 1}: ${"I recorded how my day felt. ".repeat(5)}`).join("\n\n")
    + `\n${"UnbrokenText".repeat(40)}\nFINAL NOTE TEXT.`;
  expect(entry.note.length).toBeLessThanOrEqual(4_000);
  entry.observations = REGION_IDS.map(regionId => ({ regionId, painType: "aching", meanIntensity: 2.5, peakIntensity: 5, mapCoverage: .12 }));
  await page.route("**/api/report/entries?**", route => route.fulfill({ json: { profileId: "local-you", entries: [entry] } }));
  await page.goto("/report?profile=visitor&from=2026-10-01&to=2026-10-01");
  const logs = page.getByRole("region", { name: "Logs", exact: true });
  await expect(logs.locator("tbody tr")).toHaveCount(REGION_IDS.length);
  expect((await logs.locator("[class*=logNoteText]").allTextContents()).join("")).toBe(entry.note);
  await expect(page.locator("article figure img")).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  await expect(logs.locator(logsSelector)).toHaveCSS("break-inside", "auto");
  for (const format of ["A4", "Letter"] as const) {
    const pdf = await page.pdf({ format, printBackground: true, path: testInfo.outputPath(`long-logs-${format}.pdf`) });
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(3);
  }
  await page.emulateMedia({ media: "screen" });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(async () => {
      const bounds = await page.locator("[data-report-summary]").boundingBox();
      const sheets = await logs.locator("[data-log-page]").evaluateAll(elements => elements.map(element => ({
        height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width,
        overflow: element.scrollHeight > element.clientHeight + 1,
      })));
      expect(sheets.length).toBeGreaterThanOrEqual(1);
      for (const sheet of sheets) {
        expect(sheet.height).toBeCloseTo(bounds!.height, 0);
        expect(sheet.width).toBeCloseTo(bounds!.width, 0);
        expect(sheet.overflow).toBe(false);
      }
      expect((await logs.locator("[class*=logNoteText]").allTextContents()).join("")).toBe(entry.note);
    }).toPass();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await logs.locator("h3").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`long-log-${width}.png`) });
  }
});

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);
