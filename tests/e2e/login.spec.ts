/** E2E — auth journey: wrong code rejected, real login works, logout works. */

import { test, expect } from "@playwright/test";
import { loginViaUi, logoutViaUi, requestOtp, faToEn } from "./helpers";
import { TEST_USERS } from "../../scripts/seed-test";

test.describe("login flow", () => {
  test("wrong OTP shows an error and does not enter the app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /زمان.?سنج/ })).toBeVisible();

    await requestOtp(page, TEST_USERS.collab.mobile);
    const otpInput = page.locator("[data-input-otp]");
    await otpInput.focus();
    await otpInput.pressSequentially("00000", { delay: 60 });

    // Persian error surfaces; we stay on the OTP screen
    await expect(page.locator("[role=status], .text-danger").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "کد تأیید را وارد کنید" })).toBeVisible();
  });

  test("collaborator logs in with the devCode, sees home, then logs out", async ({ page }) => {
    await loginViaUi(page, TEST_USERS.collab.mobile);
    await expect(page.getByRole("heading", { name: /سلام/ })).toBeVisible();

    await logoutViaUi(page);
  });

  test("inactive accounts are blocked at the login screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "شماره موبایل" }).fill(faToEn(TEST_USERS.inactive.mobile));
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
    await expect(page.getByText(/غیرفعال/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "کد تأیید را وارد کنید" })).toBeHidden();
  });
});
