import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";
test("public polish has a single shell, hero and accessible narrow layouts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A little hello can be the start of feeling better.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  await expect(page.getByRole("link", { name: "Sign in with phone", exact: true })).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator("body").evaluate((e) => e.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.getByRole("link", { name: "Skip to main content", exact: true }).focus();
  await page.keyboard.press("Enter");
  const hero = await page
    .getByRole("heading", {
      name: "A little hello can be the start of feeling better.",
      exact: true,
    })
    .boundingBox();
  const mobileHeader = await page.getByRole("banner").boundingBox();
  expect(hero!.y).toBeGreaterThanOrEqual(mobileHeader!.y + mobileHeader!.height);
  const signIn = page.getByRole("link", { name: "Sign in with phone", exact: true });
  await signIn.hover();
  const contrast = await signIn.evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const values = (color.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const a = luminance(style.color),
      b = luminance(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("link", { name: "Sign in with phone", exact: true }).click();
  await expect(page.getByLabel("Indian mobile number")).toBeVisible();
  expect(
    await page.getByLabel("Indian mobile number").evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: ".test-artifacts/phase9.5/login-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.screenshot({ path: ".test-artifacts/phase9.5/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 640, height: 900 });
  expect(await page.locator("body").evaluate((e) => e.scrollWidth)).toBeLessThanOrEqual(640);
  await page.goto("/login");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("link", { name: "Skip to main content", exact: true }).focus();
  await page.keyboard.press("Enter");
  const heading = await page
    .getByRole("heading", { name: "Phone sign-in", exact: true })
    .boundingBox();
  const banner = await page.getByRole("banner").boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(banner!.y + banner!.height);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("main")).toHaveCount(1);
});
for (const role of ["customer", "counselor", "admin", "incomplete"] as const)
  test(`polished ${role} navigation, mobile disclosure, focus and sign out`, async ({
    page,
    baseURL,
  }) => {
    const settings = localSettings();
    const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const phone = `+9197${randomInt(10000000, 99999999)}`,
      password = randomUUID();
    const created = await service.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { synthetic_polish_test: true },
    });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    try {
      if (role !== "incomplete")
        localDb(
          `update public.profiles set role='${role}',email='polish@example.test'where id='${id}';`,
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
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Sign in with phone", exact: true })).toHaveCount(
        0,
      );
      if (role === "incomplete") {
        await expect(
          page.getByRole("banner").getByRole("link", { name: "Complete profile", exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toHaveCount(0);
      } else {
        await page.goto(
          role === "customer" ? "/bookings" : role === "counselor" ? "/counselor" : "/admin",
        );
        const nav = page.getByRole("navigation", { name: "Workspace navigation" });
        await expect(nav).toBeVisible();
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
        const account = page
          .getByRole("banner")
          .getByRole("link", { name: "Account", exact: true });
        await account.focus();
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(account).toBeVisible();
        await expect(account).toBeFocused();
        await page.setViewportSize({ width: 1280, height: 900 });
        await nav.getByRole("link", { name: "Profile", exact: true }).focus();
        await page.setViewportSize({ width: 390, height: 844 });
        const menu = page.getByRole("button", { name: "Menu", exact: true });
        await expect(menu).toBeFocused();
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await menu.click();
        await expect(nav).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(nav.getByRole("link").first()).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(menu).toBeFocused();
        await expect(nav).toBeHidden();
        await menu.click();
        await nav.getByRole("link", { name: "Profile", exact: true }).click();
        await expect(page).toHaveURL(/\/profile$/);
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.locator("#main-content")).toHaveCount(1);
        await page.getByRole("link", { name: "Skip to main content", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("main")).toBeFocused();
        expect(await page.locator("body").evaluate((e) => e.scrollWidth)).toBeLessThanOrEqual(390);
        await page.screenshot({
          path: `.test-artifacts/phase9.5/${role}-mobile.png`,
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
    } finally {
      localDb(`delete from public.phase9_audit_events where actor_id='${id}';`);
      expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
    }
  });
