/** E2E — admin user management (the explicitly required feature):
 *  create → search → deactivate → reactivate → delete, plus the
 *  delete-with-logs guard. All row actions live inside the edit sheet. */

import { test, expect } from "@playwright/test";
import { loginViaUi, faToEn } from "./helpers";
import { TEST_USERS } from "../../scripts/seed-test";

const NEW_MOBILE = "09120000077";
const NEW_NAME = "کاربر ای‌توئی";

test.describe("admin users", () => {
  test("admin manages users end-to-end", async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.mobile);

    await page.goto("/#/users");
    await page.reload();
    await expect(page.getByRole("heading", { name: /مدیریت کاربران|کاربران/ })).toBeVisible({ timeout: 30_000 });

    // ── Create ──
    await page.getByRole("button", { name: "کاربر جدید" }).click();
    await expect(page.getByRole("heading", { name: "کاربر جدید" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("textbox", { name: "نام و نام خانوادگی" }).fill(NEW_NAME);
    await page.getByRole("textbox", { name: "شماره موبایل" }).fill(NEW_MOBILE);
    await page.getByRole("button", { name: "ایجاد کاربر" }).click();
    await expect(page.getByText("کاربر جدید ایجاد شد")).toBeVisible({ timeout: 20_000 });

    // ── Search narrows to the new user ──
    const search = page.getByLabel("جستجوی کاربر");
    await search.fill(NEW_MOBILE);
    const row = page.locator(`[aria-label="ویرایش ${NEW_NAME}"]`);
    await expect(row).toBeVisible();

    // ── Deactivate (inside edit sheet) ──
    await row.click();
    await expect(page.getByRole("button", { name: "حذف کاربر" })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("فعال بودن کاربر").click();
    await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
    await expect(page.getByText("تغییرات ذخیره شد")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("غیرفعال").first()).toBeVisible();

    // ── Reactivate ──
    await row.click();
    await page.getByLabel("فعال بودن کاربر").click();
    await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
    await expect(page.getByText("تغییرات ذخیره شد")).toBeVisible({ timeout: 20_000 });

    // ── Delete (no logs → allowed) ──
    await row.click();
    await page.getByRole("button", { name: "حذف کاربر" }).click();
    await expect(page.getByText("حذف این کاربر؟")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "حذف", exact: true }).click();
    await expect(page.getByText("کاربر حذف شد")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`[aria-label="ویرایش ${NEW_NAME}"]`)).toBeHidden({ timeout: 20_000 });

    // ── Guard: a user WITH logs cannot be deleted ──
    await search.fill(faToEn(TEST_USERS.collab.mobile));
    const collabRow = page.locator(`[aria-label="ویرایش ${TEST_USERS.collab.name}"]`);
    await expect(collabRow).toBeVisible();
    await collabRow.click();
    await page.getByRole("button", { name: "حذف کاربر" }).click();
    await page.getByRole("button", { name: "حذف", exact: true }).click();
    // server refuses: the dialog description explains the logs/deactivate rule
    await expect(page.locator('[data-slot="alert-dialog-description"]')).toContainText("گزارش ثبت‌شده دارد", { timeout: 20_000 });
    // cleanup: close the dialog
    await page.getByRole("button", { name: "انصراف" }).click().catch(() => {});
  });
});
