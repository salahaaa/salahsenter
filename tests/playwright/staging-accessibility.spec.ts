import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const enabled = process.env.PLAYWRIGHT_A11Y_AUDIT === "true";
const pages = [
  { name: "home", path: "/" },
  { name: "offers", path: "/offers" },
  { name: "login", path: "/login" }
] as const;

test.describe("Staging accessibility gate", () => {
  test.skip(!enabled, "Accessibility audit is intentionally run only against the explicit Staging URL.");

  for (const target of pages) {
    test(`${target.name} has no critical or serious Axe violations`, async ({ page }, testInfo) => {
      await page.goto(target.path, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact || ""));

      await testInfo.attach(`axe-${target.name}.json`, {
        body: JSON.stringify({ page: target.path, generatedAt: new Date().toISOString(), violations: results.violations, incomplete: results.incomplete }, null, 2),
        contentType: "application/json"
      });

      expect(blocking, `Axe blocking violations on ${target.path}: ${blocking.map((item) => item.id).join(", ")}`).toEqual([]);
    });
  }
});
