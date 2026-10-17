import { test, expect, type Page } from "@playwright/test";

// Front/back named views stand 2.9 m from the orbit target (0, 1, 0) with a 40° vertical field of view.
const DISTANCE = 2.9;
type Point = [number, number];
interface ModelPoint { x: number; y: number; z: number; view: "front" | "back" }

async function open(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("canvas")).toHaveAttribute("data-revision", /\d+/);
}
/** Model-space point (metres; +X patient-left, +Z front) seen from a named front/back view. Projected at use time, so scrolling is safe. */
async function projector(_page: Page) {
  return (x: number, y: number, z: number, view: "front" | "back" = "front"): ModelPoint => ({ x, y, z, view });
}
async function toScreen(page: Page, { x, y, z, view }: ModelPoint): Promise<Point> {
  const box = (await page.locator("canvas").boundingBox())!;
  const t = Math.tan(20 * Math.PI / 180), aspect = box.width / box.height;
  const depth = view === "front" ? DISTANCE - z : DISTANCE + z;
  const screenX = view === "front" ? x : -x;
  return [box.x + (screenX / (depth * t * aspect) + 1) / 2 * box.width, box.y + (1 - (y - 1) / (depth * t)) / 2 * box.height];
}
async function stroke(page: Page, model: ModelPoint[], steps = 12) {
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const points = await Promise.all(model.map(point => toScreen(page, point)));
  await page.mouse.move(...points[0]);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(...point, { steps });
  await page.mouse.up();
}
const observations = (page: Page) => page.locator("canvas").getAttribute("data-observations").then(value => value ?? "");
const coverage = async (page: Page, key: string) => Number((await observations(page)).split(" ").find(item => item.startsWith(`${key}:`))?.split(":")[2] ?? 0);
const pick = (page: Page, sensation: string) => page.locator("label", { hasText: sensation }).click();

test("paints the patient's left calf from the front; marks stay attached while rotating", async ({ page }) => {
  await open(page);
  const at = await projector(page);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await stroke(page, [at(.135, .42, .08), at(.135, .25, .08)]);
  expect(await observations(page)).toMatch(/left-calf:aching/);
  expect(await observations(page)).not.toMatch(/right-calf/);
  const marked = page.getByRole("region", { name: "Marked areas" });
  await expect(marked).toContainText("Your left calf");
  await expect(marked).not.toContainText("Your right calf");
  const before = await observations(page);
  const canvas = page.locator("canvas");

  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  const camera = await canvas.getAttribute("data-camera");
  await stroke(page, [at(0, 1.2, 0), at(.4, 1.1, 0)]);
  expect(await canvas.getAttribute("data-camera")).not.toBe(camera);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect(await observations(page)).toBe(before);
  await page.locator(".body-workbench").screenshot({ path: "test-results/body-paint-back-view.png" });

  // Paint the lower back from behind: the back surface only.
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  const back = await projector(page);
  await stroke(page, [back(-.1, 1.15, -.14, "back"), back(.1, 1.15, -.14, "back")]);
  expect(await observations(page)).toMatch(/back-lower-torso:aching/);
  expect(await observations(page)).not.toMatch(/front-lower-torso/);
});

test("drags that miss the body in Paint mode record nothing and do not move the camera", async ({ page }) => {
  await open(page);
  const at = await projector(page);
  const canvas = page.locator("canvas");
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  const revision = await canvas.getAttribute("data-revision");
  const camera = await canvas.getAttribute("data-camera");
  await stroke(page, [at(-.9, 1.9, 0), at(-.7, .2, 0)]);
  expect(await canvas.getAttribute("data-revision")).toBe(revision);
  expect(await canvas.getAttribute("data-camera")).toBe(camera);
  await expect(page.getByRole("region", { name: "Marked areas" })).toContainText("Nothing marked yet");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("a single fast drag covers the same path as a slow one", async ({ page }) => {
  await open(page);
  const at = await projector(page);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  const path = [at(.12, .84, .1), at(.12, .5, .08)];
  await stroke(page, path, 40);
  const slow = await coverage(page, "left-thigh:aching");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await observations(page)).toBe("");
  await stroke(page, path, 1);
  const fast = await coverage(page, "left-thigh:aching");
  expect(slow).toBeGreaterThan(0);
  expect(fast).toBeGreaterThan(slow * .9);
});

test("overlapping sensations, layer erasing, button undo, and keyboard undo", async ({ page }) => {
  await open(page);
  const at = await projector(page);
  const path = [at(-.12, .82, .1), at(-.12, .6, .09)];
  await pick(page, "Aching / dull");
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Intensity").fill("4");
  await stroke(page, path);
  await pick(page, "Burning");
  await page.getByLabel("Intensity").fill("7");
  await stroke(page, path);
  expect(await observations(page)).toContain("right-thigh:aching");
  expect(await observations(page)).toContain("right-thigh:burning");
  await expect(page.locator("label", { hasText: "Burning" })).toContainText("on map");

  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await expect(page.getByText("Erasing removes burning only.")).toBeVisible();
  await stroke(page, path);
  expect(await observations(page)).not.toContain("burning");
  expect(await observations(page)).toContain("right-thigh:aching");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await observations(page)).toContain("right-thigh:burning");
  await page.locator("canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  expect(await observations(page)).not.toContain("burning");
  await page.keyboard.press("ControlOrMeta+z");
  expect(await observations(page)).toBe("");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("brush controls are keyboard operable with visible focus", async ({ page }) => {
  await open(page);
  const intensity = page.getByLabel("Intensity");
  await intensity.focus();
  await page.keyboard.press("ArrowRight");
  await expect(intensity).toHaveValue("6");
  await expect(page.locator("output")).toContainText("6");
  const aching = page.getByRole("radio", { name: /Aching/ });
  await aching.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /Tingling/ })).toBeChecked();
  const outline = await page.locator("label", { hasText: "Tingling" }).evaluate(element => getComputedStyle(element).outlineStyle);
  expect(outline).toBe("solid");
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("capture and read-only loads never change the draft; incompatible maps are rejected visibly", async ({ page }) => {
  await open(page);
  const at = await projector(page);
  await pick(page, "Tingling / numbness");
  await stroke(page, [at(.12, .82, .1), at(.12, .6, .09)]);
  const before = await observations(page);
  const result = await page.evaluate(async () => {
    type Handle = { snapshot(): Record<string, Uint8Array>; capture(o?: object): Promise<Record<string, string>>; loadSnapshot(s: unknown): Promise<void> };
    const handle = [...(globalThis as unknown as { __painJournalBodyScenes: { handles: Set<Handle> } }).__painJournalBodyScenes.handles][0];
    const sum = (layers: Record<string, Uint8Array>) => Object.values(layers).reduce((total, layer) => total + layer.reduce((a, b) => a + b, 0), 0);
    const draft = sum(handle.snapshot());
    const copy = handle.snapshot();
    copy.tingling.fill(255);
    const aliasFree = sum(handle.snapshot()) === draft;
    const own = await handle.capture({ width: 120, height: 200 });
    const blank = Object.fromEntries(["burning", "sharp", "aching", "tingling"].map(type => [type, new Uint8Array(512 * 512)]));
    const other = await handle.capture({ layers: blank, views: ["front"], width: 120, height: 200 });
    let rejected = "";
    try { await handle.loadSnapshot({ bodyMapVersion: "mannequin-v0", width: 512, height: 512, encoding: "png-base64", layers: {} }); } catch (error) { rejected = (error as Error).name; }
    return { aliasFree, draftUnchanged: sum(handle.snapshot()) === draft, own, otherFront: other.front, otherBack: other.back, rejected };
  });
  expect(result.aliasFree).toBe(true);
  expect(result.draftUnchanged).toBe(true);
  expect(result.own.front).toMatch(/^data:image\/png;base64,/);
  expect(result.own.back).toMatch(/^data:image\/png;base64,/);
  expect(result.otherBack).toBeUndefined();
  expect(result.otherFront).not.toBe(result.own.front);
  expect(result.rejected).toBe("MapValidationError");
  await expect(page.getByRole("alert").filter({ hasText: "This painting can’t be shown" })).toContainText("mannequin-v0");
  expect(await observations(page)).toBe(before);
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await expect(page.getByText("This painting can’t be shown")).toHaveCount(0);
});

test("reduced motion freezes pain effects and keeps painting usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(page.locator("canvas")).toHaveAttribute("data-motion", "reduced");
  const at = await projector(page);
  await pick(page, "Sharp / stabbing");
  await stroke(page, [at(0, 1.4, .14), at(.1, 1.3, .14)]);
  expect(await observations(page)).toContain("front-upper-torso:sharp");
  await page.locator(".body-workbench").screenshot({ path: "test-results/body-reduced-motion.png" });
});

test("renderer failure disables painting controls and explains why", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.locator(".scene-error[role=alert]")).toContainText("The body map couldn’t load");
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Intensity")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Brush", exact: true })).toBeDisabled();
  await expect(page.locator("#scene-help")).toContainText("Painting is unavailable");
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 900 } });
  test("a finger drag paints on a phone layout without horizontal overflow", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Paint", exact: true }).tap();
    await page.locator("canvas").scrollIntoViewIfNeeded();
    const at = await projector(page);
    const client = await page.context().newCDPSession(page);
    const [x0, y0] = await toScreen(page, at(.12, .82, .1)), [x1, y1] = await toScreen(page, at(.12, .6, .09));
    const scroll = await page.evaluate(() => window.scrollY);
    const point = (x: number, y: number) => [{ x, y: y - scroll, id: 1 }];
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(x0, y0) });
    for (let i = 1; i <= 10; i++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10) });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => observations(page)).toContain("left-thigh:aching");
    await page.screenshot({ path: "test-results/body-touch-390.png", fullPage: true });
  });
});

test("navigation releases renderer resources and a remounted editor still paints", async ({ page }) => {
  await open(page);
  type Stats = { live: number; created: number; disposed: number; handles: Set<unknown> };
  const stats = () => page.evaluate(() => {
    const { live, created, disposed, handles } = (globalThis as unknown as { __painJournalBodyScenes: Stats }).__painJournalBodyScenes;
    return { live, created, disposed, handles: handles.size };
  });
  for (let i = 0; i < 3; i++) {
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect.poll(async () => (await stats()).live).toBe(0);
    expect((await stats()).handles).toBe(0);
    await page.getByRole("link", { name: "Check-in", exact: true }).click();
    await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  }
  const final = await stats();
  expect(final.live).toBe(1);
  expect(final.created - final.disposed).toBe(1);
  await expect(page.locator("canvas")).toHaveCount(1);
  const at = await projector(page);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await stroke(page, [at(.135, .42, .08), at(.135, .25, .08)]);
  expect(await observations(page)).toContain("left-calf:aching");
});

test("painting sustains the frame-rate target while effects animate", async ({ page }) => {
  await open(page);
  const at = await projector(page);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.mouse.move(...await toScreen(page, at(-.15, 1.4, .14)));
  await page.mouse.down();
  const started = Date.now();
  for (let i = 0; Date.now() - started < 2500; i++) {
    const t = i / 15;
    await page.mouse.move(...await toScreen(page, at(-.15 + .3 * (.5 + .5 * Math.sin(t)), 1.4 - .25 * (.5 + .5 * Math.cos(t * .7)), .14)));
  }
  await page.mouse.up();
  await page.waitForTimeout(1100);
  const fps = Number(await page.locator("canvas").getAttribute("data-fps"));
  test.info().annotations.push({ type: "fps", description: `${fps} rendered frames/s (Chromium ${test.info().project.use.launchOptions?.args?.join(" ") ?? "default"})` });
  expect(fps).toBeGreaterThanOrEqual(30);
});
