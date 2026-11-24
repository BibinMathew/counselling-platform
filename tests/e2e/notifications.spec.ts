import { randomInt, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("manual meetings, role isolation, local outbox and recovery", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  test.skip(
    process.env.NOTIFICATION_MODE !== "simulator" || process.env.PAYMENT_MODE !== "simulator",
    "Requires local simulators",
  );
  const settings = localSettings();
  const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const users: { id: string; phone: string }[] = [];
  const password = randomUUID();
  const counselor = randomUUID();
  let booking = "";
  try {
    for (let i = 0; i < 4; i++) {
      const phone = `+9197${randomInt(10000000, 99999999)}`;
      const result = await service.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
        user_metadata: { synthetic_notification_test: true },
      });
      if (result.error || !result.data.user) throw new Error("Synthetic account creation failed");
      users.push({ id: result.data.user.id, phone });
    }
    const [admin, counselorUser, customer, other] = users;
    localDb(`do $$ begin
   update public.profiles set role='admin',email='admin@example.test' where id='${admin.id}';
   update public.profiles set role='counselor',email='counselor@example.test' where id='${counselorUser.id}';
   update public.profiles set email='customer@example.test' where id in('${customer.id}','${other.id}');
   perform set_config('request.jwt.claim.sub','${admin.id}',true);
   insert into public.counselors(id,profile_id,display_name,bio,qualifications,experience,category,specialties,languages,photo_url,published)
   values('${counselor}','${counselorUser.id}','Notification Browser Fixture','Test','Test','Test','consultant_psychologist','Stress','English','https://example.test/a.png',true);
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
    const customerClient = await signIn(page, customer);
    await page.goto(`/counselors/${counselor}`);
    await page.locator(".available-day li a").first().click();
    await expect(page.getByRole("button", { name: "Hold this time" })).toBeVisible();
    await expect(page.getByText("Payment is not available yet.", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Hold this time" }).click();
    await page.getByRole("button", { name: /Pay ₹/ }).click();
    await page.getByRole("button", { name: "Simulate captured payment" }).click();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.getByText("Meeting link will follow.", { exact: true })).toBeVisible();
    const held = await service
      .from("bookings")
      .select("id")
      .eq("customer_id", customer.id)
      .single();
    expect(held.error).toBeNull();
    booking = held.data!.id;
    const jobCount = async () =>
      (await service.from("notification_jobs").select("id").eq("booking_id", booking)).data!.length;
    expect(await jobCount()).toBe(4);
    await signIn(page, admin);
    await page.goto("/admin/appointments");
    const row = page.locator("article").filter({ hasText: booking });
    await expect(row).toContainText("Meeting link will follow.");
    // Random canonical link avoids colliding with retained demo link reservations.
    const letters = randomUUID()
      .replace(/[^a-f]/g, "")
      .padEnd(10, "a")
      .slice(0, 10);
    const url = `https://meet.google.com/${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
    await row.getByLabel("Google Meet link").fill(url);
    await row.getByRole("button", { name: "Save meeting link" }).click();
    await expect(row.getByRole("status")).toHaveText("Meeting link saved.");
    await page.screenshot({ path: ".test-artifacts/phase6-appointments.png", fullPage: true });
    expect(await jobCount()).toBe(5);
    await row.getByRole("button", { name: "Save meeting link" }).click();
    await expect(row.getByRole("status")).toHaveText("Meeting link saved.");
    expect(await jobCount()).toBe(5);
    await signIn(page, customer);
    await page.goto("/bookings");
    await expect(page.getByRole("link", { name: "Join Meet" })).toHaveAttribute("href", url);
    const context = await browser.newContext();
    const foreign = await context.newPage();
    try {
      await signIn(foreign, other);
      await foreign.goto("/bookings");
      await expect(foreign.getByRole("link", { name: "Join Meet" })).toHaveCount(0);
      await foreign.goto("/admin/appointments");
      await expect(foreign).toHaveURL(/unauthorized/);
    } finally {
      await context.close();
    }
    await signIn(page, counselorUser);
    await page.goto("/counselor");
    await expect(page.getByRole("link", { name: "Join Meet" })).toHaveAttribute("href", url);
    await signIn(page, admin);
    await page.goto("/admin/notifications");
    const confirmation = page
      .locator("article")
      .filter({ hasText: booking })
      .filter({ has: page.getByRole("heading", { name: "confirmation", exact: true }) });
    await confirmation.getByRole("button", { name: "Fail next attempt" }).click();
    await expect(confirmation.getByRole("status")).toContainText("transient failure");
    await page.getByRole("button", { name: "Run notification batch" }).click();
    await expect(confirmation).toContainText("retrying");
    await confirmation.getByRole("button", { name: "Retry notification" }).click();
    await expect(confirmation).toContainText("email · queued");
    await page.getByRole("button", { name: "Run notification batch" }).click();
    await expect(confirmation).toContainText("delivered");
    await confirmation.getByText("Synthetic preview", { exact: true }).click();
    await expect(confirmation).toContainText("Your appointment is confirmed.");
    expect(await confirmation.innerText()).not.toContain(url);
    await page.screenshot({ path: ".test-artifacts/phase6-notifications.png", fullPage: true });
    const receiptsBefore = await service
      .from("notification_simulator_receipts")
      .select("job_id")
      .in(
        "job_id",
        (await service.from("notification_jobs").select("id").eq("booking_id", booking)).data!.map(
          (j) => j.id,
        ),
      );
    expect(receiptsBefore.data).toHaveLength(3);
    // A real customer reschedule supersedes old reminders, keeps delivered receipts and Meet link.
    const slots = await customerClient.rpc("get_public_availability", {
      p_counselor_id: counselor,
    });
    expect(slots.error).toBeNull();
    // Hold a real reschedule transaction open while another connection dispatches
    // an already claimed reminder. Completion must wait and reject the old schedule.
    const reminder = await service
      .from("notification_jobs")
      .select("id")
      .eq("booking_id", booking)
      .eq("template", "reminder_24h")
      .single();
    expect(reminder.error).toBeNull();
    localDb(
      `update public.notification_jobs set due_at=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' where id='${reminder.data!.id}';`,
    );
    const reminderClaims = await service.rpc("claim_notification_jobs", { p_limit: 20 });
    expect(reminderClaims.error).toBeNull();
    const reminderClaim = reminderClaims.data!.find(
      (j: { id: string }) => j.id === reminder.data!.id,
    )!;
    expect(reminderClaim).toBeTruthy();
    const rancher = process.env.LOCAL_SUPABASE_RANCHER === "1";
    const reschedule = new Promise<string>((resolve, reject) => {
      const child = execFile(
        rancher ? "rdctl" : "docker",
        [
          ...(rancher ? ["shell", "--", "docker"] : []),
          "exec",
          "-i",
          "supabase_db_counselling-platform",
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-X",
          "-v",
          "ON_ERROR_STOP=1",
          "-At",
        ],
        { encoding: "utf8" },
        (error, stdout) => (error ? reject(error) : resolve(stdout)),
      );
      child.stdin!.end(
        `begin; select set_config('request.jwt.claim.sub','${customer.id}',true); set local role authenticated; select public.reschedule_booking('${booking}','${counselor}','${slots.data![0].start_at}'); select pg_sleep(2); commit;`,
      );
    });
    let locked = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (
        Number(
          localDb(
            "select count(*) from pg_locks where locktype='advisory' and objid=70324004 and granted;",
          ).trim(),
        ) > 0
      ) {
        locked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(locked).toBe(true);
    const stale = await service.rpc("dispatch_simulated_notification", {
      p_job_id: reminderClaim.id,
      p_lease_token: reminderClaim.lease_token,
      p_app_origin: baseURL!,
    });
    await reschedule;
    expect(stale.error).toBeNull();
    expect(stale.data).toBe("stale");
    expect(
      (
        await service
          .from("notification_simulator_receipts")
          .select("job_id")
          .eq("job_id", reminderClaim.id)
      ).data,
    ).toEqual([]);
    const jobs = await service.from("notification_jobs").select("*").eq("booking_id", booking);
    expect(jobs.data!.filter((j) => j.status === "superseded")).toHaveLength(2);
    expect(jobs.data!.filter((j) => j.status === "delivered")).toHaveLength(3);
    expect(jobs.data!.filter((j) => j.schedule_revision === 1)).toHaveLength(4);
    // Independent concurrent PostgREST workers must receive disjoint claims.
    const claims = await Promise.all([
      service.rpc("claim_notification_jobs", { p_limit: 20 }),
      service.rpc("claim_notification_jobs", { p_limit: 20 }),
    ]);
    for (const result of claims) expect(result.error).toBeNull();
    const ids = claims.flatMap((r) => r.data!.map((j: { id: string }) => j.id));
    expect(new Set(ids).size).toBe(ids.length);
    const ours = claims
      .flatMap((r) => r.data!)
      .filter((j: { id: string }) => jobs.data!.some((row) => row.id === j.id));
    expect(ours).toHaveLength(2);
    for (const job of ours)
      expect(
        (
          await service.rpc("dispatch_simulated_notification", {
            p_job_id: job.id,
            p_lease_token: job.lease_token,
            p_app_origin: baseURL!,
          })
        ).data,
      ).toBe("delivered");
    // More than one page of terminal failures must remain available for recovery.
    const failures = Array.from({ length: 101 }, (_, index) => ({
      booking_id: booking,
      recipient_id: customer.id,
      channel: "email",
      template: "confirmation",
      schedule_revision: 100 + index,
      link_revision: 0,
      due_at: new Date().toISOString(),
      next_attempt_at: new Date().toISOString(),
      status: "failed",
      attempts: 5,
    }));
    expect((await service.from("notification_jobs").insert(failures)).error).toBeNull();
    await page.goto("/admin/notifications?status=failed");
    await expect(page.getByRole("link", { name: "Older jobs" })).toBeVisible();
    await page.getByRole("link", { name: "Older jobs" }).click();
    await expect(page.getByRole("link", { name: "Newer jobs" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: booking })).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: ".test-artifacts/phase6-notifications-mobile.png",
      fullPage: true,
    });
    await signIn(page, customer);
    await page.goto("/bookings");
    await expect(page.getByRole("link", { name: "Join Meet" })).toHaveAttribute("href", url);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
    const denied = await page.request.post("/api/notifications/dispatch");
    expect(denied.status()).toBe(401);
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
    delete from public.counselors where id='${counselor}';
    delete from public.counselor_catalog_audit_events where actor_user_id in(${ids});
    delete from public.availability_audit_events where actor_user_id in(${ids});
   end $$;`);
      for (const user of users)
        expect((await service.auth.admin.deleteUser(user.id)).error).toBeNull();
    }
  }
});
