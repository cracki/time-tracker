/** E2E — the core collaborative loop: create a log, see it in the compact
 * list, edit it, and watch status chips update. */

import { test, expect } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { TEST_USERS } from "../../scripts/seed-test";

const DESC = `تست E2E — توسعه ویژگی ${Date.now()}`;

test.describe("log flow", () => {
  test("collaborator creates a 01:30 log and sees it in my logs", async ({ page }) => {
    await loginViaUi(page, TEST_USERS.collab.mobile);

    // Open the log form via the center FAB
    await page.locator('[aria-label="ثبت زمان جدید"]').click();
    await expect(page.getByRole("heading", { name: "ثبت زمان جدید" })).toBeVisible({ timeout: 30_000 });

    // Duration: type 0130 → ۰۱:۳۰ (90 minutes)
    const duration = page.getByLabel("مدت زمان به فرمت ساعت:دقیقه");
    await duration.click();
    await duration.pressSequentially("0130", { delay: 70 });
    await expect(page.getByText(/ساعت/)).toBeVisible(); // humanDuration hint

    // Description
    await page.getByLabel("توضیحات").fill(DESC);

    // Submit — the app navigates to my-logs afterwards
    await page.getByRole("button", { name: "ثبت زمان", exact: true }).click();
    await expect(page.getByRole("heading", { name: "زمان‌های من" })).toBeVisible({ timeout: 30_000 });

    // The compact (virtualized) list shows the new entry with a pending chip
    const row = page.locator('[role="listitem"]').filter({ hasText: DESC }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("در انتظار")).toBeVisible();
  });

  test("pending log can be edited via detail screen", async ({ page }) => {
    await loginViaUi(page, TEST_USERS.collab.mobile);

    await page.goto("/#/logs");
    await page.reload();
    await expect(page.getByRole("heading", { name: "زمان‌های من" })).toBeVisible({ timeout: 30_000 });

    const row = page.locator('[role="listitem"]').filter({ hasText: DESC }).first();
    await expect(row).toBeVisible();
    await row.click();

    // Detail → edit
    await expect(page.getByRole("button", { name: "ویرایش گزارش" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "ویرایش گزارش" }).click();
    await expect(page.getByRole("heading", { name: "ویرایش گزارش" })).toBeVisible({ timeout: 30_000 });

    const newDesc = `${DESC} ویرایش‌شده`;
    await page.getByLabel("توضیحات").fill(newDesc);
    await page.getByRole("button", { name: "ذخیره تغییرات" }).click();

    // Back on my-logs with the updated description
    await expect(page.getByRole("heading", { name: "زمان‌های من" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[role="listitem"]').filter({ hasText: newDesc }).first()).toBeVisible({ timeout: 30_000 });
  });
});
