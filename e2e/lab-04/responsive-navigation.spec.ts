import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@toktickit.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Lab4Evidence123!";

test.describe("RSP-01 Administrator navigation at mobile width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps every Administrator destination inside the 375px viewport", async ({ page }) => {
    await page.goto("/#/dashboard");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    for (const destination of ["Dashboard", "Ticket Queue", "User Management"]) {
      await page.getByRole("button", { name: destination, exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    }
  });
});
