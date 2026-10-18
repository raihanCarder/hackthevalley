import { test, expect } from "./local-fixture";
import { BODY_MAP_VERSION } from "../../src/domain/contracts";

test("deep links, Node route, and browser-only renderer load without hydration errors", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  for (const path of ["/history", "/report", "/check-in", "/"]) {
    await page.goto(path);
    if (path === "/") await expect(page.getByRole("region", { name: "Body map", exact: true })).toBeVisible();
    else await expect(page.locator("h1")).toBeVisible();
  }
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  const response = await request.get("/api/status");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ milestone: "foundation", bodyMapVersion: BODY_MAP_VERSION });
  expect(errors).toEqual([]);
});

test("camera reaches named views and Paint mode blocks pointer, wheel, and keyboard orbit", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  const canvas = page.locator("canvas");
  const positions: string[] = [];
  for (const name of ["Back", "Your left", "Your right", "Front"]) {
    await page.getByRole("button", { name, exact: true }).click();
    positions.push((await canvas.getAttribute("data-camera"))!);
    await page.locator(".body-workbench").screenshot({ path: `test-results/body-${name.replaceAll(" ", "-").toLowerCase()}.png` });
  }
  expect(new Set(positions).size).toBe(4);
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  expect(await canvas.getAttribute("data-camera")).not.toBe(positions[3]);
  const box = (await canvas.boundingBox())!;
  async function drag() {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 10 }); await page.mouse.up();
  }
  const beforeRotate = await canvas.getAttribute("data-camera");
  await drag();
  expect(await canvas.getAttribute("data-camera")).not.toBe(beforeRotate);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  const beforePaint = await canvas.getAttribute("data-camera");
  await drag(); await page.mouse.wheel(0, 150); await canvas.focus(); await page.keyboard.press("ArrowLeft");
  expect(await canvas.getAttribute("data-camera")).toBe(beforePaint);
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Camera views", exact: true })).toBeHidden();
  await expect(page.getByRole("group", { name: "Zoom to a body part", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect(await canvas.getAttribute("data-camera")).toBe(positions[0]);
});

test("phone, tablet, and desktop retain visible controls without horizontal overflow", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Paint", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    const editor = (await page.locator(".body-workbench").boundingBox())!;
    expect(Math.round(editor.y + editor.height)).toBe(1000);
    await expect(page.locator(".stage-topbar, .check-in-heading")).toHaveCount(0);
    await page.screenshot({ path: `test-results/check-in-${width}.png`, fullPage: true });
  }
});

test("renderer failure has an explicit accessible error state", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.locator(".scene-error[role=alert]")).toContainText("The body map couldn’t load");
  await expect(page.getByRole("button", { name: "Reload body map" })).toBeVisible();
});

test("navigation remounts a single working scene", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 2; i++) {
    await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page.getByRole("region", { name: "Body map", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Check-in", exact: true }).click();
  }
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("canvas")).toHaveCount(1);
});
