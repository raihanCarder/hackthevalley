import { test, expect } from "./local-fixture";
import { chooseProfile } from "./profiles";

test("homepage is readable without journal services or WebGL at all supported widths", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/") && request.method() !== "GET") mutations.push(request.url());
  });
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: { message: "Unavailable for homepage check" } } }));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900], [1440, 720], [390, 600], [768, 768], [1280, 720], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/home");
    await expect(page).toHaveTitle("feel | Map what you feel.");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Map what you feel.");
    await expect(page.getByRole("main")).toContainText("rotatable 3D body");
    await expect(page.getByRole("complementary", { name: "Explore the sample journal" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open body map", exact: true })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Explore history", exact: true })).toHaveAttribute("href", "/history");
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const actions = page.getByRole("link", { name: "Explore history", exact: true });
    expect(await actions.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    const workflow = page.getByRole("region", { name: "From a daily feeling to a picture over time." });
    await expect(workflow).toBeVisible();
    for (const description of await workflow.locator("dt, dd").all()) {
      await expect(description).toBeVisible();
      expect(await description.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
      }), `Feature description fits at ${width}×${height}`).toBe(true);
    }
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await expect(navigation.getByRole("link")).toHaveText(["Home", "Check-in", "History", "Appointment report"]);
    await expect(navigation.locator('[aria-current="page"]')).toHaveText("Home");
    await expect(page.getByRole("button", { name: "Switch profile, current profile You" })).toBeEnabled();
    await page.screenshot({ path: `test-results/homepage-${width}.png`, fullPage: true });

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    for (const name of ["Open body map", "Explore history"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name, exact: true })).toBeFocused();
    }
    // Return to the first tab stop, then traverse the wordmark, all four links, and profile menu.
    await page.goto("/home");
    for (const name of ["Skip to content", "feel home", "Home", "Check-in", "History", "Appointment report"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name, exact: true })).toBeFocused();
      await expect.poll(() => page.getByRole("link", { name, exact: true }).evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      }), { message: `${name} scrolls fully into view at ${width}px` }).toBe(true);
    }
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Switch profile, current profile You" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemradio")).toHaveCount(2);
    await page.keyboard.press("Escape");
  }
  expect(mutations).toEqual([]);
});

for (const profile of ["You", "Maya"] as const) {
  test(`homepage connects existing workflows and retains ${profile} without saving`, async ({ page }) => {
    const mutations: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/api/") && request.method() !== "GET") mutations.push(request.url());
    });
    await page.goto("/home");
    await chooseProfile(page, profile);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const current = nav.locator('[aria-current="page"]');
    const selectedProfile = page.getByRole("button", { name: `Switch profile, current profile ${profile}` });

    await page.getByRole("link", { name: "Open body map", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(current).toHaveText("Check-in");
    await expect(selectedProfile).toBeVisible();
    await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.getByRole("link", { name: "feel home", exact: true }).click();
    await expect(current).toHaveText("Home");
    await expect(page.locator("canvas")).toHaveCount(0);

    await page.getByRole("link", { name: "Explore history", exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(current).toHaveText("History");
    await expect(selectedProfile).toBeVisible();
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await nav.getByRole("link", { name: "Appointment report", exact: true }).click();
    await expect(current).toHaveText("Appointment report");
    await expect(selectedProfile).toBeVisible();
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(current).toHaveText("Home");

    await page.goto("/check-in");
    await expect(current).toHaveText("Check-in");
    await expect(selectedProfile).toBeVisible();
    await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(mutations).toEqual([]);
  });
}

test("shared navigation fits alongside the existing editor, history, and report", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/home");
  await chooseProfile(page, "Maya");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, label] of [["/", "check-in"], ["/history", "history"], ["/report", "report"]]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Switch profile, current profile Maya" })).toBeEnabled();
      if (path !== "/report") await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
      else {
        await expect(page.getByText("Days with a check-in", { exact: true })).toBeVisible();
        await expect(page.getByRole("img", { name: "Front of the body showing every location marked in this range", exact: true })).toBeVisible();
        await expect(page.getByRole("img", { name: "Back of the body showing every location marked in this range", exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/homepage-integration-${label}-${width}.png`, fullPage: true });
    }
  }
});
