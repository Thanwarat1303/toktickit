import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@toktickit.local";
// Seeded accounts start with this password and must change it on their first sign-in.
// The second password makes the spec repeatable when desktop and mobile run against
// the same database one after the other.
const initialPassword = process.env.LAB3_INITIAL_PASSWORD ?? "LAB3_INITIAL_PASSWORD_MUST_CHANGE";
const configuredPassword = process.env.E2E_ADMIN_PASSWORD;
const e2ePassword = process.env.E2E_ADMIN_NEW_PASSWORD ?? "E2EResponsiveAdmin123!";

async function signInAsAdministrator(page: import("@playwright/test").Page) {
  const passwords = [...new Set([configuredPassword, initialPassword, e2ePassword].filter((value): value is string => Boolean(value)))];

  for (const password of passwords) {
    await page.goto("/#/dashboard");
    if (await page.getByRole("heading", { name: "Dashboard" }).isVisible().catch(() => false)) return;
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    const nextScreen = await Promise.race([
      page.getByRole("heading", { name: "Dashboard" }).waitFor({ state: "visible", timeout: 5_000 }).then(() => "dashboard"),
      page.getByRole("heading", { name: "Choose a new password" }).waitFor({ state: "visible", timeout: 5_000 }).then(() => "change-password"),
      page.getByRole("alert").waitFor({ state: "visible", timeout: 5_000 }).then(() => "error"),
    ]).catch(() => "error");

    if (nextScreen === "dashboard") return;
    if (nextScreen === "change-password") {
      await page.getByLabel("Current password").fill(password);
      await page.getByLabel("New password", { exact: true }).fill(e2ePassword);
      await page.getByLabel("Confirm new password").fill(e2ePassword);
      await page.getByRole("button", { name: "Save new password" }).click();
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      return;
    }
  }

  throw new Error("Unable to sign in as the Administrator. Set E2E_ADMIN_PASSWORD if this database uses a non-seed password.");
}

test.describe("RSP-01 Administrator navigation at mobile width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps every Administrator destination inside the 375px viewport", async ({ page }) => {
    await signInAsAdministrator(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    for (const destination of ["Dashboard", "Ticket Queue", "User Management"]) {
      await page.getByRole("button", { name: destination, exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    }
  });
});
