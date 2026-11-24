import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("local feedback and admin cases preserve privacy, retries and source facts", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  test.skip(process.env.FEEDBACK_ADMIN_MODE !== "local", "Requires local workspace");
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
        user_metadata: { synthetic_phase9_test: true },
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
   values('${counselor}','${counselorUser.id}','Phase9 Browser Fixture','Test','Test','Test','consultant_psychologist','Stress','English','https://example.test/a.png',true);
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

    const delayedSubmit = async (
      button: import("@playwright/test").Locator,
      fields: import("@playwright/test").Locator[],
    ) => {
      let release!: () => void;
      let reached = false;
      let completed!: () => void;
      const continued = new Promise<void>((resolve) => {
        completed = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const handler = async (route: import("@playwright/test").Route) => {
        if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
          reached = true;
          await gate;
          try {
            await route.continue();
          } finally {
            completed();
          }
        } else await route.continue();
      };
      await page.route("**/*", handler);
      try {
        await button.click();
        await expect.poll(() => reached).toBe(true);
        return await Promise.all(fields.map((field) => field.isDisabled()));
      } finally {
        release();
        if (reached) await continued;
        await page.unroute("**/*", handler);
      }
    };

    booking = randomUUID();
    const past = randomUUID();
    localDb(
      `begin;select set_config('request.jwt.claim.sub','${admin.id}',true);
     update public.profiles set preferred_name='Fictional Customer' where id='${customer.id}';

     insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)
     select '${booking}','${customer.id}','${counselor}',s.start_at,s.end_at,s.end_at+interval '15 minutes','confirmed',now()+interval '10 minutes' from public.get_public_availability('${counselor}')s limit1;
     insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)
     values('${past}','${customer.id}','${counselor}',now()-interval '2 days',now()-interval '2 days'+interval '45 minutes',now()-interval '2 days'+interval '1 hour','confirmed',now()-interval '3 days');commit;`.replace(
        "limit1",
        "limit 1",
      ),
    );
    await signIn(page, customer);
    await page.goto(`/bookings/${past}/feedback`);
    await expect(
      page.getByRole("heading", { name: "Private appointment feedback", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Rating").selectOption("5");
    await page
      .getByLabel("Optional feedback")
      .fill("Fictional phase9 feedback <script>unsafe()</script>");
    await page.getByRole("button", { name: "Submit private feedback", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("confirm fictional");
    await expect(page.getByLabel("Rating")).toHaveValue("5");
    await expect(page.getByLabel("Optional feedback")).toHaveValue(
      "Fictional phase9 feedback <script>unsafe()</script>",
    );
    await page
      .getByRole("checkbox", { name: "I am using fictional test content only.", exact: true })
      .check();
    const feedbackLocked = await delayedSubmit(
      page.getByRole("button", { name: "Submit private feedback", exact: true }),
      [page.getByLabel("Rating"), page.getByLabel("Optional feedback")],
    );
    await expect(
      page.getByRole("heading", { name: "Your submitted feedback", exact: true }),
    ).toBeVisible();
    expect(feedbackLocked).toEqual([true, true]);
    await page.reload();
    await expect(page.getByText("Your submitted feedback", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Fictional phase9 feedback <script>unsafe()</script>", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit private feedback" })).toHaveCount(0);
    await page.goto("/bookings?view=past");
    await expect(
      page.locator(`[data-booking-id="${past}"]`).getByRole("link", { name: "View feedback" }),
    ).toBeVisible();
    for (const user of [other, counselorUser]) {
      await signIn(page, user);
      await page.goto(`/bookings/${past}/feedback`);
      await expect(
        page.getByRole("heading", {
          name: user.id === other.id ? "404" : "Access unavailable",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Fictional phase9 feedback <script>unsafe()</script>", { exact: true }),
      ).toHaveCount(0);
    }
    await signIn(page, admin);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".test-artifacts/phase9.5/admin-overview-desktop.png",
      fullPage: true,
    });
    await page.goto(`/admin/feedback?counselor=${counselor}`);
    await expect(
      page.getByText("Fictional phase9 feedback <script>unsafe()</script>", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Acknowledge review", exact: true }).click();
    await expect(page.getByText(/^Reviewed /)).toBeVisible();
    await page.goto(`/admin/bookings?booking=${past}`);
    await expect(page.locator(`[data-booking-id="${past}"]`)).toContainText("confirmed");
    await page.getByRole("link", { name: "Open operational case", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Operational remark", exact: true })
      .fill("Fictional phase9 case creation.");
    await page
      .getByRole("checkbox", { name: "I am using fictional test content only.", exact: true })
      .check();
    let canceledSignOut = 0;
    const keepDraft = async (dialog: import("@playwright/test").Dialog) => {
      canceledSignOut++;
      await dialog.dismiss();
    };
    page.on("dialog", keepDraft);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    page.off("dialog", keepDraft);
    expect(canceledSignOut).toBe(1);
    await expect(
      page.getByRole("textbox", { name: "Operational remark", exact: true }),
    ).toHaveValue("Fictional phase9 case creation.");
    const openLocked = await delayedSubmit(
      page.getByRole("button", { name: "Open case", exact: true }),
      [
        page.getByRole("combobox", { name: "Source type", exact: true }),
        page.getByRole("textbox", { name: "Source ID", exact: true }),
        page.getByRole("textbox", { name: "Operational remark", exact: true }),
      ],
    );
    await expect(page.getByRole("status")).toContainText("opened");
    expect(openLocked).toEqual([true, true, true]);
    await page
      .locator("form")
      .filter({ has: page.getByRole("heading", { name: "Open an operational case", exact: true }) })
      .getByRole("link", { name: "View case", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Operational case", exact: true }),
    ).toBeVisible();
    const caseUrl = page.url();
    const caseId = caseUrl.split("/").at(-1)!;
    const staleContext = await browser.newContext();
    const stale = await staleContext.newPage();
    try {
      await signIn(stale, admin);
      await stale.goto(caseUrl);
      await expect(stale.getByText("Case status: Open · Version 1", { exact: true })).toBeVisible();
      await page.getByLabel("Case action").selectOption("start");
      await page
        .getByRole("textbox", { name: "Operational remark", exact: true })
        .fill("Fictional active follow-up.");
      await page
        .getByRole("checkbox", { name: "I am using fictional test content only.", exact: true })
        .check();
      const updateLocked = await delayedSubmit(
        page.getByRole("button", { name: "Update case", exact: true }),
        [
          page.getByRole("combobox", { name: "Case action", exact: true }),
          page.getByRole("textbox", { name: "Operational remark", exact: true }),
        ],
      );
      await expect(page.getByRole("status")).toContainText("version 2");
      expect(updateLocked).toEqual([true, true]);
      await stale.getByLabel("Case action").selectOption("close");
      await stale
        .getByRole("textbox", { name: "Operational remark", exact: true })
        .fill("Fictional stale closing draft.");
      await stale
        .getByRole("checkbox", { name: "I am using fictional test content only.", exact: true })
        .check();
      await stale.getByRole("button", { name: "Update case", exact: true }).click();
      await expect(stale.getByRole("status")).toContainText("changed");
      await expect(
        stale.getByRole("textbox", { name: "Operational remark", exact: true }),
      ).toHaveValue("Fictional stale closing draft.");
    } finally {
      await staleContext.close();
    }
    await page.getByLabel("Case action").selectOption("close");
    await page
      .getByRole("textbox", { name: "Operational remark", exact: true })
      .fill("Fictional administrative follow-up closed.");
    await page
      .getByRole("checkbox", { name: "I am using fictional test content only.", exact: true })
      .check();
    await page.getByRole("button", { name: "Update case", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("version 3");
    await page.reload();
    await expect(page.getByText("Case status: Closed · Version 3", { exact: true })).toBeVisible();
    const source = await service
      .from("bookings")
      .select("status,reschedule_count")
      .eq("id", past)
      .single();
    expect(source.data).toEqual({ status: "confirmed", reschedule_count: 0 });
    await page
      .getByRole("textbox", { name: "Operational remark", exact: true })
      .fill("Fictional explicit reopening.");
    await page
      .getByRole("checkbox", { name: "I am using fictional test content only.", exact: true })
      .check();
    await page.getByRole("button", { name: "Update case", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("version 4");
    const request = randomUUID();
    const update = {
      p_actor: admin.id,
      p_case: caseId,
      p_expected: 4,
      p_request: request,
      p_action: "start",
      p_remark: "Fictional ambiguous response retry.",
      p_ack: true,
    };
    expect((await service.rpc("phase9_update_case", update)).data).toMatchObject({
      accepted_version: 5,
    });
    expect((await service.rpc("phase9_update_case", update)).data).toMatchObject({
      accepted_version: 5,
      current_version: 5,
      replayed: true,
    });
    expect(
      (
        await service.rpc("phase9_update_case", {
          ...update,
          p_expected: 5,
          p_request: randomUUID(),
          p_action: "close",
        })
      ).data,
    ).toMatchObject({ accepted_version: 6 });
    expect((await service.rpc("phase9_update_case", update)).data).toMatchObject({
      accepted_version: 5,
      current_version: 6,
      replayed: true,
    });
    await page.reload();
    await expect(page.getByText("Case status: Closed · Version 6", { exact: true })).toBeVisible();
    const simultaneous = await Promise.all(
      ["A", "B"].map((label) =>
        service.rpc("phase9_update_case", {
          p_actor: admin.id,
          p_case: caseId,
          p_expected: 6,
          p_request: randomUUID(),
          p_action: "reopen",
          p_remark: `Fictional simultaneous ${label}`,
          p_ack: true,
        }),
      ),
    );
    expect(simultaneous.filter((r) => !r.error)).toHaveLength(1);
    expect(simultaneous.filter((r) => r.error?.code === "40001")).toHaveLength(1);
    await page.reload();
    await expect(page.getByText("Case status: Open · Version 7", { exact: true })).toBeVisible();
    const concurrentBooking = randomUUID();
    localDb(
      `begin;select set_config('request.jwt.claim.sub','${admin.id}',true);insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)values('${concurrentBooking}','${customer.id}','${counselor}',now()-interval '5 days',now()-interval '5 days'+interval '45 minutes',now()-interval '5 days'+interval '1 hour','confirmed',now()-interval '6 days');commit;`,
    );
    const feedbackWrites = await Promise.all(
      [4, 5].map((rating) =>
        service.rpc("phase9_submit_feedback", {
          p_actor: customer.id,
          p_booking: concurrentBooking,
          p_rating: rating,
          p_comment: "Fictional concurrent feedback",
          p_ack: true,
        }),
      ),
    );
    expect(feedbackWrites.every((r) => !r.error)).toBe(true);
    expect(feedbackWrites.map((r) => r.data.result).sort()).toEqual(["conflict", "saved"]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("textbox", { name: "Operational remark", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("checkbox", { name: "I am using fictional test content only.", exact: true }),
    ).toBeFocused();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: ".test-artifacts/phase9-case-mobile.png", fullPage: true });
  } finally {
    if (users.length) {
      const ids = users.map((u) => `'${u.id}'`).join(",");
      localDb(`do $$ begin
    perform set_config('request.jwt.claim.sub','${users[0].id}',true);
    delete from public.phase9_audit_events where actor_id in(${ids});
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

test("disabled feedback/admin preserves existing pages without private reads", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FEEDBACK_ADMIN_MODE !== "disabled", "Requires disabled feedback/admin");
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
    user_metadata: { synthetic_disabled_phase9_test: true },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    localDb(
      `update public.profiles set role='admin',email='disabled@example.test' where id='${id}';`,
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
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin area", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toHaveCount(0);
    await page.goto("/admin/exceptions");
    await expect(
      page.getByText("Local feedback and administration are disabled.", { exact: true }),
    ).toBeVisible();
    localDb(`update public.profiles set role='customer'where id='${id}';`);
    await page.goto(`/bookings/${randomUUID()}/feedback`);
    await expect(
      page.getByText("Local feedback and administration are disabled.", { exact: true }),
    ).toBeVisible();
    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: "Your bookings", exact: true })).toBeVisible();
    expect(
      localDb(`select count(*)from public.phase9_audit_events where actor_id='${id}';`).trim(),
    ).toBe("0");
  } finally {
    expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
