import { randomUUID, randomInt, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("simulator checkout retries, verifies, reconciles and protects payment ownership", async ({
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
  const password = randomUUID();
  const users: { id: string; phone: string }[] = [];
  const counselor = randomUUID();
  let internalOrder = "";
  try {
    for (let i = 0; i < 4; i++) {
      const phone = `+9196${randomInt(10000000, 99999999)}`;
      const result = await service.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
        user_metadata: { synthetic_payment_test: true },
      });
      if (result.error || !result.data.user) throw new Error("Test account creation failed");
      users.push({ id: result.data.user.id, phone });
    }
    const [admin, counselorUser, customer, other] = users;
    localDb(`do $$ begin
      update public.profiles set role='admin',email='admin@example.test' where id='${admin.id}';
      update public.profiles set role='counselor',email='counselor@example.test' where id='${counselorUser.id}';
      update public.profiles set email='customer@example.test' where id in ('${customer.id}','${other.id}');
      perform set_config('request.jwt.claim.sub','${admin.id}',true);
      insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,specialties,languages,photo_url,published)
      values('${counselor}','${counselorUser.id}','Payment Browser Fixture','Test','Test','Test','Stress','English','https://example.test/image.png',true);
      perform public.save_availability_exception('${counselor}',null,(now() at time zone 'Asia/Kolkata')::date+2,'opening',false,'09:00','18:00');
    end $$;`);
    const signIn = async (target: typeof page, user: { phone: string }) => {
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
    };
    await signIn(page, customer);
    await page.goto(`/counselors/${counselor}`);
    await page.locator(".available-day li a").first().click();
    await page.getByRole("button", { name: "Hold this time" }).click();
    await expect(page).toHaveURL(/\/bookings$/);
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await expect(
      page.getByRole("heading", { name: "Payment simulator", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Simulate failed attempt" }).click();
    await expect(page.getByRole("status")).toContainText("failed");
    await page.reload();
    await expect(page.getByText("Payment attempt: failed", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await page.getByRole("button", { name: "Close checkout" }).click();
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    const order = await service
      .from("payment_orders")
      .select("id")
      .eq("customer_id", customer.id)
      .single();
    expect(order.error).toBeNull();
    internalOrder = order.data!.id;
    const expiry = await service
      .from("bookings")
      .select("hold_expires_at")
      .eq("customer_id", customer.id)
      .single();
    await page.getByRole("button", { name: "Simulate captured payment" }).click();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    const after = await service
      .from("bookings")
      .select("hold_expires_at")
      .eq("customer_id", customer.id)
      .single();
    expect(after.data!.hold_expires_at).toBe(expiry.data!.hold_expires_at);
    const audit = await service
      .from("booking_audit_events")
      .select("id")
      .eq("action", "confirmed")
      .eq(
        "booking_id",
        (await service.from("payment_orders").select("booking_id").eq("id", internalOrder).single())
          .data!.booking_id,
      );
    expect(audit.data).toHaveLength(1);
    const ctx = await browser.newContext();
    const otherPage = await ctx.newPage();
    await signIn(otherPage, other);
    await otherPage.goto("/bookings");
    await expect(otherPage.getByText("Payment Browser Fixture")).toHaveCount(0);
    const forbidden = await otherPage.request.post("/api/payments/checkout", {
      headers: { Origin: baseURL! },
      data: {
        bookingId: (
          await service.from("payment_orders").select("booking_id").eq("id", internalOrder).single()
        ).data!.booking_id,
      },
    });
    expect(forbidden.ok()).toBe(false);
    const ownerRefresh = await page.request.post("/api/payments/refresh", {
      headers: { Origin: baseURL! },
      data: { id: internalOrder },
    });
    expect(ownerRefresh.status()).toBe(200);
    const foreignRefresh = await otherPage.request.post("/api/payments/refresh", {
      headers: { Origin: baseURL! },
      data: { id: internalOrder },
    });
    expect(foreignRefresh.status()).toBe(400);
    await ctx.close();
    const bad = await page.request.post("/api/payments/webhook", {
      data: { event: "payment.captured" },
      headers: { "x-razorpay-signature": "bad", "x-razorpay-event-id": "bad" },
    });
    expect(bad.status()).toBe(400);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
    // A second checkout captures at the provider but loses delivery; reconciliation recovers it.
    await page.goto(`/counselors/${counselor}`);
    await page.locator(".available-day li a").first().click();
    await page.getByRole("button", { name: "Hold this time" }).click();
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await page.getByRole("button", { name: "Capture without delivery" }).click();
    await expect(page.getByRole("status")).toContainText("Recheck");
    await page.getByRole("button", { name: "Close checkout" }).click();
    await page
      .locator("article")
      .filter({ has: page.getByRole("button", { name: /Pay ₹/ }) })
      .getByRole("button", { name: "Recheck payment" })
      .click();
    await expect(page.getByText("Confirmed", { exact: true })).toHaveCount(2);
    // Recover a provider order created before an interrupted local attachment.
    const recoveryClient = createClient(settings.API_URL, settings.PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    expect(
      (await recoveryClient.auth.signInWithPassword({ phone: customer.phone, password })).error,
    ).toBeNull();
    await page.goto(`/counselors/${counselor}`);
    await page.locator(".available-day li a").first().click();
    await page.getByRole("button", { name: "Hold this time" }).click();
    await expect(page).toHaveURL(/\/bookings$/);
    const recoveryBooking = await service
      .from("bookings")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("status", "held")
      .single();
    expect(recoveryBooking.error).toBeNull();
    const recovery = await recoveryClient.rpc("reserve_payment_order", {
      p_booking_id: recoveryBooking.data!.id,
      p_provider: "simulator",
    });
    expect(recovery.error).toBeNull();
    expect((await service.rpc("claim_payment_order", { p_order_id: recovery.data.id })).data).toBe(
      true,
    );
    expect(
      (
        await service.from("payment_simulator_orders").insert({
          id: "sim_order_" + recovery.data.id,
          receipt: recovery.data.id,
          amount: recovery.data.amount_paise,
          currency: "INR",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await service.rpc("note_payment_order_problem", {
          p_order_id: recovery.data.id,
          p_reason: "creation_uncertain",
        })
      ).error,
    ).toBeNull();
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await expect(
      page.getByRole("heading", { name: "Payment simulator", exact: true }),
    ).toBeVisible();
    const recovered = await service
      .from("payment_simulator_orders")
      .select("id")
      .eq("receipt", recovery.data.id);
    expect(recovered.data).toHaveLength(1);
    await page.getByRole("button", { name: "Simulate captured payment" }).click();
    await expect(page.getByText("Confirmed", { exact: true })).toHaveCount(3);
    // Replaying a correctly signed provider event still yields one confirmation.
    const simulation = await service
      .from("payment_simulator_orders")
      .select("*")
      .eq("receipt", internalOrder)
      .single();
    const pay = simulation.data!.payments.find((p: { status: string }) => p.status === "captured");
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: pay } },
    });
    const signature = createHmac("sha256", process.env.PAYMENT_SIMULATOR_SECRET!)
      .update(body)
      .digest("hex");
    for (let i = 0; i < 2; i++)
      expect(
        (
          await page.request.post("/api/payments/webhook", {
            data: body,
            headers: {
              "content-type": "application/json",
              "x-razorpay-signature": signature,
              "x-razorpay-event-id": "test-" + internalOrder,
            },
          })
        ).ok(),
      ).toBe(true);
    // Two expired checkouts compete for the same original slot. Only one may confirm.
    const actors = [customer, other].map(() =>
      createClient(settings.API_URL, settings.PUBLISHABLE_KEY, { auth: { persistSession: false } }),
    );
    for (let i = 0; i < actors.length; i++)
      expect(
        (await actors[i].auth.signInWithPassword({ phone: [customer, other][i].phone, password }))
          .error,
      ).toBeNull();
    const slots = await actors[0].rpc("get_public_availability", { p_counselor_id: counselor });
    const lateOrders: string[] = [];
    const lateAmounts: number[] = [];
    for (let i = 0; i < actors.length; i++) {
      const held = await actors[i].rpc("create_booking_hold", {
        p_counselor_id: counselor,
        p_start_at: slots.data![0].start_at,
      });
      expect(held.error).toBeNull();
      const reserved = await actors[i].rpc("reserve_payment_order", {
        p_booking_id: held.data,
        p_provider: "simulator",
      });
      expect(reserved.error).toBeNull();
      lateOrders.push(reserved.data.id);
      lateAmounts.push(reserved.data.amount_paise);
      expect(
        (await service.rpc("claim_payment_order", { p_order_id: reserved.data.id })).data,
      ).toBe(true);
      expect(
        (
          await service.rpc("attach_payment_order", {
            p_order_id: reserved.data.id,
            p_external_id: "sim_race_" + reserved.data.id,
          })
        ).error,
      ).toBeNull();
      localDb(
        `update public.bookings set hold_expires_at=now()-interval '1 second' where id='${held.data}';`,
      );
    }
    const races = await Promise.all(
      lateOrders.map((id, i) =>
        service.rpc("apply_payment_observation", {
          p_order_id: id,
          p_event_id: "race-" + id,
          p_digest: "a".repeat(64),
          p_payment_id: "race-payment-" + i + "-" + id,
          p_state: "captured",
          p_amount: lateAmounts[i],
          p_currency: "INR",
        }),
      ),
    );
    for (const result of races) expect(result.error).toBeNull();
    expect(races.map((result) => result.data).sort()).toEqual(["admin_review", "confirmed"]);
    // Concurrent callback/reconciliation representations of one capture are idempotent.
    const winner = lateOrders[races.findIndex((result) => result.data === "confirmed")];
    const winnerIndex = lateOrders.indexOf(winner);
    const repeated = await Promise.all(
      [0, 1, 2].map((i) =>
        service.rpc("apply_payment_observation", {
          p_order_id: winner,
          p_event_id: "race-repeat-" + i + "-" + winner,
          p_digest: String(i + 1).repeat(64),
          p_payment_id: "race-payment-" + winnerIndex + "-" + winner,
          p_state: "captured",
          p_amount: lateAmounts[winnerIndex],
          p_currency: "INR",
        }),
      ),
    );
    for (const result of repeated) {
      expect(result.error).toBeNull();
      expect(result.data).toBe("confirmed");
    }
    await page.context().clearCookies();
    await signIn(page, admin);
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
    await expect(page.getByText("Admin review: slot conflict")).toBeVisible();
    await page.getByRole("button", { name: "Reconcile payments" }).click();
    await expect(page.getByRole("status")).toContainText("Checked");
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
        delete from public.booking_audit_events where booking_id in(select id from public.bookings where counselor_id='${counselor}');
        delete from public.bookings where counselor_id='${counselor}';
        delete from public.availability_exceptions where counselor_id='${counselor}';
        perform set_config('request.jwt.claim.sub','${users[0].id}',true);
        delete from public.counselors where id='${counselor}';
        delete from public.counselor_catalog_audit_events where actor_user_id in(${ids});
        delete from public.availability_audit_events where actor_user_id in(${ids});
      end $$;`);
      for (const user of users) await service.auth.admin.deleteUser(user.id);
    }
  }
});
