import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { expect, test } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

for (const role of ["customer", "counselor", "admin"] as const) {
  test(`profile displays and saves ${role} account details`, async ({ page, baseURL }) => {
    const settings = localSettings();
    const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const phone = `+9196${randomInt(10000000, 99999999)}`;
    const password = randomUUID();
    const created = await service.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { synthetic_profile_design: true },
    });
    if (created.error || !created.data.user) throw new Error("Synthetic account creation failed");
    const id = created.data.user.id;
    try {
      localDb(
        `update public.profiles set role='${role}',email='profile-design@example.test',preferred_name='Initial Name' where id='${id}'`,
      );
      const cookies = new Map<string, string>();
      const client = createServerClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
      });
      expect((await client.auth.signInWithPassword({ phone, password })).error).toBeNull();
      await page
        .context()
        .addCookies([...cookies].map(([name, value]) => ({ name, value, url: baseURL! })));
      await page.goto("/profile");
      await expect(page.getByRole("heading", { name: "Your profile" })).toHaveCSS(
        "font-family",
        /Georgia/,
      );
      await expect(page.getByText(phone, { exact: true })).toBeVisible();
      await expect(page.getByText("profile-design@example.test", { exact: true })).toBeVisible();
      await expect(page.getByText("Email address not verified.")).toBeVisible();
      await expect(page.locator("input[type=email], input[type=tel]")).toHaveCount(0);
      await expect(page.locator(".profile-details time")).toBeVisible();
      await expect(page.locator(".profile-sidebar")).toBeVisible();
      await expect(page.getByRole("link", { name: "View bookings" })).toHaveCount(
        role === "customer" ? 1 : 0,
      );
      await expect(page.getByText("Account role", { exact: true })).toHaveCount(
        role === "customer" ? 0 : 1,
      );
      if (role !== "customer")
        await expect(
          page.getByText(role === "admin" ? "Administrator" : "Counselor", { exact: true }).last(),
        ).toBeVisible();

      const name = page.getByLabel("Preferred name", { exact: true });
      await expect(name).toHaveValue("Initial Name");
      await name.fill("   ");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.locator(".profile-form").getByRole("alert")).toContainText(
        "Enter a preferred name",
      );
      await name.fill("New Pseudonym");
      await page.getByRole("button", { name: "Save profile" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText("Profile updated.");
      await page.reload();
      await expect(name).toHaveValue("New Pseudonym");
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(name).toBeVisible();
        expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
      if (role === "customer") {
        const bookings = page.getByRole("link", { name: "View bookings" });
        await bookings.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/bookings$/);
        await expect(page.getByRole("heading", { name: "Your bookings" })).toBeVisible();
      }
    } finally {
      expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
    }
  });
}
