import { expect, type Page } from "@playwright/test";
export async function chooseProfile(page: Page, name: "You" | "Maya") {
  const trigger = page.getByRole("button", { name: /^Switch profile, current profile/ });
  await expect(trigger).toBeEnabled();
  if ((await trigger.getAttribute("aria-label"))?.endsWith(name)) return;
  await trigger.click();
  await page.getByRole("menuitemradio", { name: name === "You" ? /^You/ : /^Maya/ }).click();
  await expect(trigger).toHaveAttribute("aria-label", `Switch profile, current profile ${name}`);
}
