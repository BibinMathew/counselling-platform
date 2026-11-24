import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { expect, test } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("customer bookings retain their filters and responsive layout in the new design", async ({
  page,
  baseURL,
}) => {
  const settings = localSettings();
  const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const users: string[] = [];
  const password = randomUUID();
  const counselorId = randomUUID();
  const bookingId = randomUUID();
  try {
    const phones = Array.from({ length: 3 }, () => `+9196${randomInt(10000000, 99999999)}`);
    for (const phone of phones) {
      const created = await service.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
        user_metadata: { synthetic_bookings_design: true },
      });
      if (created.error || !created.data.user) throw new Error("Synthetic account creation failed");
      users.push(created.data.user.id);
    }
    const [admin, counselor, customer] = users;
    localDb(`do $$ begin
      update public.profiles set role='admin',email='admin@example.test' where id='${admin}';
      update public.profiles set role='counselor',email='counselor@example.test' where id='${counselor}';
      update public.profiles set email='customer@example.test' where id='${customer}';
      perform set_config('request.jwt.claim.sub','${admin}',true);
      insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
      values('${counselorId}','${counselor}','Design Fixture','Test','Test','Test','consultant_psychologist','Test','English','https://example.test/a.png',true);
      insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)
      values('${bookingId}','${customer}','${counselorId}',now()-interval '2 days',now()-interval '2 days'+interval '45 minutes',now()-interval '2 days'+interval '1 hour','expired',now()-interval '3 days');
      end $$;`);
    const cookies = new Map<string, string>();
    const client = createServerClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
      },
    });
    expect((await client.auth.signInWithPassword({ phone: phones[2], password })).error).toBeNull();
    await page
      .context()
      .addCookies([...cookies].map(([name, value]) => ({ name, value, url: baseURL! })));
    await page.goto("/bookings");
    const card = page.locator(`[data-booking-id="${bookingId}"]`);
    await expect(card).toContainText("Design Fixture");
    await expect(card).toContainText("Hold expired");
    const heading = page.getByRole("heading", { name: "Your bookings" });
    await expect(heading).toHaveCSS("font-family", /Georgia/);
    await expect(card.locator(".date-tile")).toHaveCSS("background-color", "rgb(226, 240, 229)");
    await page.screenshot({ path: ".test-artifacts/bookings-design-desktop.png", fullPage: true });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(card).toBeVisible();
      expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.getByRole("link", { name: "Upcoming", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("No upcoming appointments.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Upcoming", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await page.getByRole("link", { name: "Holds", exact: true }).click();
      await expect(card).toBeVisible();
    }
    await page.goto("/profile");
    await expect(page.locator(".bookings-sidebar")).toHaveCount(0);
  } finally {
    localDb(`do $$ begin
      delete from public.bookings where id='${bookingId}';
      perform set_config('request.jwt.claim.sub','${users[0] ?? ""}',true);
      delete from public.counselors where id='${counselorId}';
      delete from public.counselor_catalog_audit_events where counselor_id='${counselorId}';
      end $$;`);
    for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
