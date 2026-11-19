import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("signed-out landing page offers sign-in and discovery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in with phone", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find a counselor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Your account" })).toHaveCount(0);
});

const cases = [
  { role: "customer", complete: true, links: ["/customer", "/bookings", "/profile"] },
  {
    role: "counselor",
    complete: true,
    links: ["/counselor", "/counselor/availability", "/profile"],
  },
  {
    role: "admin",
    complete: true,
    links: [
      "/admin",
      "/admin/counselors",
      "/admin/availability",
      "/admin/appointments",
      "/admin/notifications",
      "/admin/payments",
      "/profile",
    ],
  },
  { role: "customer", complete: false, links: ["/complete-profile"] },
] as const;
for (const scenario of cases)
  test(`landing navigation for ${scenario.complete ? scenario.role : "incomplete customer"} and sign-out`, async ({
    page,
    baseURL,
  }) => {
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Requires local Supabase");
    const settings = localSettings();
    const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const phone = `+9198${randomInt(10000000, 99999999)}`;
    const password = randomUUID();
    const created = await service.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { synthetic_home_navigation: true, role: "admin" },
    });
    if (created.error || !created.data.user)
      throw new Error("Synthetic navigation fixture creation failed");
    const id = created.data.user.id;
    try {
      localDb(
        `update public.profiles set role='${scenario.role}',email=${scenario.complete ? "'navigation@example.test'" : "null"} where id='${id}';`,
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
      await page.goto("/");
      const nav = page.getByRole("navigation", { name: "Your account" });
      await expect(nav).toBeVisible();
      await expect(page.getByRole("link", { name: "Sign in with phone", exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
      const hrefs = await nav
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")).sort());
      expect(hrefs).toEqual([...scenario.links].sort());
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
      if (scenario.complete)
        await page.screenshot({
          path: `.test-artifacts/home-${scenario.role}.png`,
          fullPage: true,
        });
      await page.reload();
      await expect(nav).toBeVisible();
      if (scenario.complete) {
        await nav.getByRole("link").first().click();
        await expect(page).toHaveURL(`${baseURL}${scenario.links[0]}`);
        await expect(
          page.getByRole("heading", {
            name:
              scenario.role === "admin"
                ? "Admin area"
                : scenario.role === "counselor"
                  ? "Counselor area"
                  : "Customer area",
            exact: true,
          }),
        ).toBeVisible();
        await page.goBack();
        await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
      }
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto("/");
      await expect(
        page.getByRole("link", { name: "Sign in with phone", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Your account" })).toHaveCount(0);
      await page.goto(
        scenario.role === "admin"
          ? "/admin"
          : scenario.role === "counselor"
            ? "/counselor"
            : "/bookings",
      );
      await expect(page).toHaveURL(/\/login/);
    } finally {
      expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
    }
  });
