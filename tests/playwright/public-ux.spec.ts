import { expect, test } from "@playwright/test";

test.describe("public UX smoke", () => {
  test("homepage is accessible, RTL and keyboard navigable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("header")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toHaveCount(1);
  });

  test("offers page has canonical SEO metadata", async ({ page }) => {
    await page.goto("/offers");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });
});
