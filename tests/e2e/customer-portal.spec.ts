import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("customer portal history, rebooking, checkout continuity and ownership", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  test.skip(process.env.PAYMENT_MODE !== "simulator", "Requires local payment simulator");
  const settings = localSettings();
  const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const users: { id: string; phone: string }[] = [];
  const password = randomUUID();
  const counselor = randomUUID();
  const secondCounselor = randomUUID();
  let booking = "";
  try {
    for (let i = 0; i < 5; i++) {
      const phone = `+9197${randomInt(10000000, 99999999)}`;
      const result = await service.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
        user_metadata: { synthetic_portal_test: true },
      });
      if (result.error || !result.data.user) throw new Error("Synthetic account creation failed");
      users.push({ id: result.data.user.id, phone });
    }
    const [admin, counselorUser, customer, other, secondCounselorUser] = users;
    localDb(`do $$ begin
   update public.profiles set role='admin',email='admin@example.test' where id='${admin.id}';
   update public.profiles set role='counselor',email='counselor@example.test' where id='${counselorUser.id}';
   update public.profiles set email='customer@example.test' where id in('${customer.id}','${other.id}');
   perform set_config('request.jwt.claim.sub','${admin.id}',true);
   insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
   values('${counselor}','${counselorUser.id}','Portal Browser Fixture','Test','Test','Test','consultant_psychologist','Stress','English','https://example.test/a.png',true);
   perform public.save_availability_exception('${counselor}',null,(now() at time zone 'Asia/Kolkata')::date+2,'opening',false,'09:00','18:00');
  end $$;`);
    const signIn = async (target: typeof page, user: { phone: string }) => {
      await target.context().clearCookies();
      const cookies = new Map<string, string>();
      const client = createServerClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
      });
      const result = await client.auth.signInWithPassword({ phone: user.phone, password });
      if (result.error) throw result.error;
      await target
        .context()
        .addCookies([...cookies].map(([name, value]) => ({ name, value, url: baseURL! })));
      return client;
    };

    localDb(`begin;select set_config('request.jwt.claim.sub','${admin.id}',true);
      update public.profiles set role='counselor',email='alternate@example.test' where id='${secondCounselorUser.id}';
      insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
      values('${secondCounselor}','${secondCounselorUser.id}','Portal Alternate Fixture','Test','Test','Test','consultant_psychologist','Stress','English','https://example.test/b.png',true);
      select public.save_availability_exception('${secondCounselor}',null,(now() at time zone 'Asia/Kolkata')::date+3,'opening',false,'10:00','15:00');commit;`);
    const pastBooking = randomUUID();
    const legacyBooking = randomUUID();
    const oldOrder = randomUUID();
    localDb(`insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at,created_at)
     values('${pastBooking}','${customer.id}','${counselor}',now()-interval '3 days',now()-interval '3 days'+interval '45 minutes',now()-interval '3 days'+interval '1 hour','confirmed',now()-interval '4 days',now()-interval '5 days'),
     ('${legacyBooking}','${customer.id}','${counselor}',now()-interval '2 days',now()-interval '2 days'+interval '45 minutes',now()-interval '2 days'+interval '1 hour','confirmed',now()-interval '3 days',now()-interval '4 days');
     insert into public.payment_orders(id,booking_id,customer_id,provider,amount_paise,currency,confirmed_payment_id) values('${oldOrder}','${pastBooking}','${customer.id}','simulator',50000,'INR','history_${oldOrder}');
     insert into public.bookings(customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at,created_at)
     select '${customer.id}','${counselor}',now()-interval '10 days',now()-interval '10 days'+interval '45 minutes',now()-interval '10 days'+interval '1 hour','expired',now()-interval '11 days',now()-interval '12 days' from generate_series(1,21);`);
    await signIn(page, customer);
    await page.goto("/bookings");
    await expect(page.getByRole("link", { name: "Upcoming", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Upcoming", exact: true }).click();
    await expect(page.getByText("No upcoming appointments.")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("link", { name: "All", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("link", { name: "Past", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/view=past/);
    await page.getByRole("link", { name: "Holds", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(20);
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await page.reload();
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByRole("link", { name: "Previous page" }).click();
    await expect(page.locator("article")).toHaveCount(20);
    await page.getByRole("link", { name: "Past", exact: true }).click();
    const past = page.locator(`[data-booking-id="${pastBooking}"]`);
    const legacy = page.locator(`[data-booking-id="${legacyBooking}"]`);
    await expect(past).toContainText("Past appointment");
    await expect(past).toContainText("₹500.00");
    await expect(legacy).toBeVisible();
    await expect(legacy).not.toContainText("₹");
    await expect(page.getByRole("link", { name: "Join Meet" })).toHaveCount(0);
    await expect(page.getByText("Completed", { exact: true })).toHaveCount(0);
    const countBefore = (await service.from("bookings").select("id").eq("customer_id", customer.id))
      .data!.length;
    await past.getByRole("link", { name: "Book Again", exact: true }).click();
    expect(
      (await service.from("bookings").select("id").eq("customer_id", customer.id)).data,
    ).toHaveLength(countBefore);
    await page.locator(".available-day li a").first().click();
    await page.getByRole("button", { name: "Hold this time" }).click();
    await page.getByRole("link", { name: "Holds", exact: true }).click();
    const payingHold = await service
      .from("bookings")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("status", "held")
      .single();
    expect(payingHold.error).toBeNull();
    localDb(
      `update public.bookings set created_at=now()-interval '20 days' where id='${payingHold.data!.id}';`,
    );
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await page.getByRole("button", { name: "Simulate captured payment" }).click();
    await expect(page).toHaveURL(`${baseURL}/bookings?booking=${payingHold.data!.id}`);
    await expect(page.getByText(/Page 2 · Times shown/)).toBeVisible();
    const latest = await service
      .from("bookings")
      .select("id")
      .eq("customer_id", customer.id)
      .gt("start_at", new Date().toISOString())
      .single();
    expect(latest.error).toBeNull();
    booking = latest.data!.id;
    await expect(
      page.locator(`[data-booking-id="${booking}"]`).getByText("Confirmed", { exact: true }),
    ).toBeVisible();
    const newOrder = await service
      .from("payment_orders")
      .select("id,amount_paise")
      .eq("booking_id", booking)
      .single();
    expect(newOrder.error).toBeNull();
    expect(newOrder.data!.id).not.toBe(oldOrder);
    const currentPrice = await service.from("payment_settings").select("amount_paise").single();
    expect(newOrder.data!.amount_paise).toBe(currentPrice.data!.amount_paise);
    expect(
      (await service.from("payment_orders").select("amount_paise").eq("id", oldOrder).single())
        .data!.amount_paise,
    ).toBe(50000);
    await page.getByRole("link", { name: "Upcoming", exact: true }).click();
    await expect(page.getByText("Meeting link will follow.", { exact: true })).toBeVisible();
    localDb(
      `begin;select set_config('request.jwt.claim.sub','${admin.id}',true);select public.set_booking_meeting('${booking}','https://meet.google.com/abc-port-alx');commit;`,
    );
    await page.reload();
    await expect(page.getByRole("link", { name: "Join Meet" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-port-alx",
    );
    await page.getByRole("link", { name: "Reschedule", exact: true }).click();
    await page.locator(".available-day li a").first().click();
    await page.getByRole("button", { name: "Reschedule appointment", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/bookings?booking=${booking}`);
    const upcomingCard = page.locator(`[data-booking-id="${booking}"]`);
    await expect(upcomingCard.getByRole("link", { name: "Join Meet" })).toBeVisible();
    await expect(upcomingCard.getByRole("link", { name: "Reschedule", exact: true })).toHaveCount(
      0,
    );
    localDb(
      `begin;select set_config('request.jwt.claim.sub','${admin.id}',true);update public.counselors set published=false where id='${counselor}';commit;`,
    );
    await page.goto("/bookings?view=past");
    await expect(legacy).toContainText("currently unavailable");
    await expect(legacy.getByRole("link", { name: "Browse counselors" })).toHaveAttribute(
      "href",
      "/counselors",
    );
    await legacy.getByRole("link", { name: "Browse counselors" }).click();
    await page.getByRole("link", { name: "Portal Alternate Fixture", exact: true }).click();
    await page.locator(".available-day li a").first().click();
    await page.getByRole("button", { name: "Hold this time" }).click();
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await page.getByRole("button", { name: "Simulate captured payment" }).click();
    const alternateCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Portal Alternate Fixture", exact: true }),
    });
    await expect(alternateCard.getByText("Confirmed", { exact: true })).toBeVisible();
    expect(
      (await service.from("bookings").select("counselor_id").eq("id", booking).single()).data!
        .counselor_id,
    ).toBe(counselor);
    expect(
      (
        await service
          .from("bookings")
          .select("id")
          .eq("customer_id", customer.id)
          .eq("counselor_id", secondCounselor)
      ).data,
    ).toHaveLength(1);
    await page.goto("/bookings?view=past");
    const context = await browser.newContext();
    const foreign = await context.newPage();
    try {
      await signIn(foreign, other);
      await foreign.goto("/bookings");
      await expect(foreign.getByText("You have no holds or appointments.")).toBeVisible();
      await expect(foreign.locator("article")).toHaveCount(0);
    } finally {
      await context.close();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: ".test-artifacts/phase7-mobile-history.png", fullPage: true });
  } finally {
    if (users.length) {
      const ids = users.map((u) => `'${u.id}'`).join(",");
      localDb(`do $$ begin
    perform set_config('request.jwt.claim.sub','${users[0].id}',true);
    delete from public.payment_simulator_orders where receipt in(select id from public.payment_orders where customer_id in(${ids}));
    delete from public.payment_events where order_id in(select id from public.payment_orders where customer_id in(${ids}));
    delete from public.payment_audit_events where actor_id in(${ids}) or order_id in(select id from public.payment_orders where customer_id in(${ids}));
    delete from public.payment_transactions where order_id in(select id from public.payment_orders where customer_id in(${ids}));
    delete from public.payment_orders where customer_id in(${ids});
    delete from public.booking_audit_events where booking_id in(select id from public.bookings where counselor_id in('${counselor}','${secondCounselor}'));
    delete from public.bookings where counselor_id in('${counselor}','${secondCounselor}');
    delete from public.availability_exceptions where counselor_id in('${counselor}','${secondCounselor}');
    delete from public.counselors where id in('${counselor}','${secondCounselor}');
    delete from public.counselor_catalog_audit_events where actor_user_id in(${ids});
    delete from public.availability_audit_events where actor_user_id in(${ids});
   end $$;`);
      for (const user of users)
        expect((await service.auth.admin.deleteUser(user.id)).error).toBeNull();
    }
  }
});
