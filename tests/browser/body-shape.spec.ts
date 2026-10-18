import { test, expect, type Page } from "@playwright/test";
import { landmark, project } from "./body-landmarks";

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("canvas")).toHaveAttribute("data-revision", /\d+/);
}
async function paintCalf(page: Page) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await page.mouse.move(...project(box, landmark("left-calf-upper")));
  await page.mouse.down();
  await page.mouse.move(...project(box, landmark("left-calf-lower")), { steps: 10 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-observations", /left-calf:aching/);
}

test("body-shape sliders reshape the figure without changing marks or measurements, and persist in this browser", async ({ page }) => {
  await open(page);
  await paintCalf(page);
  const canvas = page.locator("canvas");
  const before = await canvas.getAttribute("data-observations");
  await page.getByRole("button", { name: "Body", exact: true }).click();
  const panel = page.getByRole("region", { name: "Body shape" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Reset body shape" })).toBeDisabled();
  await panel.getByLabel("Height", { exact: true }).fill("0");
  await expect.poll(async () => Number(await canvas.getAttribute("data-body-height"))).toBeLessThan(.95);
  await panel.getByLabel("Sex", { exact: true }).fill("1");
  await panel.getByLabel("Waist and belly", { exact: true }).fill("0.8");
  await panel.getByText("More options").click();
  await panel.getByLabel("Age", { exact: true }).fill("0.6");
  await expect(panel.getByLabel("Age", { exact: true })).toHaveAttribute("aria-valuetext", /about \d+ years/);
  expect(await canvas.getAttribute("data-observations")).toBe(before);
  await page.locator(".body-workbench").screenshot({ path: "test-results/body-shape-custom.png" });

  await page.reload();
  await expect(page.locator(".scene-mount")).toHaveAttribute("data-status", "ready");
  await expect.poll(async () => Number(await canvas.getAttribute("data-body-height"))).toBeLessThan(.95);
  await page.getByRole("button", { name: "Body", exact: true }).click();
  await expect(page.getByRole("region", { name: "Body shape" }).getByLabel("Height", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Reset body shape" }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-body-height"))).toBe(1);
  await expect(page.getByRole("button", { name: "Reset body shape" })).toBeDisabled();
});
