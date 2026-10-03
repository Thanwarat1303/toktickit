import { expect, test } from "@playwright/test";

const requesterEmail = process.env.E2E_REQUESTER_EMAIL ?? "anan.student@toktickit.local";
const initialPassword = process.env.LAB3_INITIAL_PASSWORD ?? "LAB3_INITIAL_PASSWORD_MUST_CHANGE";

test.describe("E2E-01 Authentication and first password", () => {
  test("shows a safe error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("not-a-user@example.test");
    await page.getByLabel("Password").fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  });

  test("requires a seeded first-login account to choose a new password", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(requesterEmail);
    await page.getByLabel("Password").fill(initialPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await expect(page.getByText("you must change the initial password before continuing")).toBeVisible();
  });
});
