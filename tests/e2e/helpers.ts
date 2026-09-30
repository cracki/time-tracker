/** Shared E2E helpers: OTP login through the real UI. */

import { Page, expect } from "@playwright/test";

const FA_TO_EN: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function faToEn(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => FA_TO_EN[d] ?? d);
}

/** Request the OTP, transparently waiting out the 30s server-side resend
 * cooldown (spec §4) if a previous test already consumed this phone. */
export async function requestOtp(page: Page, phone: string): Promise<void> {
  await page.getByRole("textbox", { name: "شماره موبایل" }).fill(faToEn(phone));
  const otpHeading = page.getByRole("heading", { name: "کد تأیید را وارد کنید" });

  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) {
      // still on the login screen — the previous click hit the cooldown
      await page.waitForTimeout(6000);
    }
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
    try {
      await otpHeading.waitFor({ timeout: 5000 });
      return;
    } catch {
      // either cooldown error (shown as toast) or slow compile — retry
    }
  }
  throw new Error(`OTP screen never appeared for ${phone}`);
}

/** Login through the UI (mobile number → devCode from the hint → OTP).
 * Works for both roles: collaborators land on home (سلام …), admins on the
 * team dashboard (داشبورد تیم). */
export async function loginViaUi(page: Page, phone: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /زمان.?سنج/ })).toBeVisible();

  await requestOtp(page, phone);
  await expect(page.getByRole("heading", { name: "کد تأیید را وارد کنید" })).toBeVisible();

  // Read the dev-mode OTP hint (auto-hidden in production once SMS is on)
  const hint = await page.getByText(/کد تأیید \(حالت توسعه\)/).textContent();
  expect(hint).toBeTruthy();
  const code = faToEn(hint!).replace(/\D/g, "");
  expect(code).toHaveLength(5);

  const otpInput = page.locator("[data-input-otp]");
  await otpInput.focus(); // hidden input — focus() works where click() can't
  await otpInput.pressSequentially(code, { delay: 60 });

  await expect(
    page.getByRole("heading", { name: /سلام/ }).or(page.getByRole("heading", { name: "داشبورد تیم" })),
  ).toBeVisible({ timeout: 30_000 });
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.goto("/#/account");
  await page.reload();
  const logout = page.getByRole("button", { name: "خروج از حساب" }).first();
  await logout.click();
  // confirm dialog if present
  const confirm = page.getByRole("button", { name: /خروج/ }).last();
  try {
    await confirm.click({ timeout: 4000 });
  } catch { /* no confirm dialog */ }
  await expect(page.getByRole("heading", { name: /زمان.?سنج/ })).toBeVisible({ timeout: 30_000 });
}
