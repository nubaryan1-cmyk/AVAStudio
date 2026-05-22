import { expect, test } from "@playwright/test";

test("главная показывает заголовок AVAStudio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AVAStudio" })).toBeVisible();
});
