import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { test, expect } from "@playwright/test";
import { localDb, localSettings } from "../helpers/local-supabase";

test("local counselor notes are encrypted, private and conflict safe", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  test.skip(process.env.COUNSELOR_WORKSPACE_MODE !== "local", "Requires local workspace");
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
        user_metadata: { synthetic_workspace_test: true },
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
   values('${counselor}','${counselorUser.id}','Workspace Browser Fixture','Test','Test','Test','consultant_psychologist','Stress','English','https://example.test/a.png',true);
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

    booking = randomUUID();
    const past = randomUUID();
    localDb(
      `begin;select set_config('request.jwt.claim.sub','${admin.id}',true);
     update public.profiles set preferred_name='Fictional Customer' where id='${customer.id}';
     update public.profiles set role='counselor' where id='${other.id}';
     insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)
     select '${booking}','${customer.id}','${counselor}',s.start_at,s.end_at,s.end_at+interval '15 minutes','confirmed',now()+interval '10 minutes' from public.get_public_availability('${counselor}')s limit1;
     insert into public.bookings(id,customer_id,counselor_id,start_at,end_at,buffer_end_at,status,hold_expires_at)
     values('${past}','${customer.id}','${counselor}',now()-interval '2 days',now()-interval '2 days'+interval '45 minutes',now()-interval '2 days'+interval '1 hour','confirmed',now()-interval '3 days');commit;`.replace(
        "limit1",
        "limit 1",
      ),
    );
    await signIn(page, counselorUser);
    await page.goto(`/counselor/appointments/${booking}`);
    await expect(page.getByRole("heading", { name: "Session details", exact: true })).toBeVisible();
    await expect(page.getByText("Fictional Customer", { exact: true })).toBeVisible();
    const editor = page.getByLabel("Private session note");
    const discardAndReload = async () => {
      const accept = async (dialog: import("@playwright/test").Dialog) => dialog.accept();
      page.on("dialog", accept);
      try {
        await page.reload();
      } finally {
        page.off("dialog", accept);
      }
    };
    await editor.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("I am using fictional test content only.")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Save private note", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByLabel("I am using fictional test content only.")).toBeFocused();
    await editor.fill("Fictional test note: first revision.");
    await page.getByRole("button", { name: "Save private note" }).click();
    await expect(page.getByRole("status")).toContainText("acknowledgement");
    await page.getByLabel("I am using fictional test content only.").check();
    await page.getByRole("button", { name: "Save private note" }).click();
    await expect(page.getByRole("status")).toContainText(/version\s*1/);
    await page.reload();
    await expect(editor).toHaveValue("Fictional test note: first revision.");
    await editor.fill("Fictional unsaved draft must survive navigation.");
    let fragmentPrompts = 0;
    const cancelFragment = async (dialog: import("@playwright/test").Dialog) => {
      fragmentPrompts++;
      await dialog.dismiss();
    };
    page.on("dialog", cancelFragment);
    await page.getByRole("link", { name: "Skip to main content", exact: true }).focus();
    await page.keyboard.press("Enter");
    page.off("dialog", cancelFragment);
    expect(fragmentPrompts).toBe(0);
    await expect(page.getByRole("main")).toBeFocused();
    let signOutPrompts = 0;
    const cancelSignOut = async (dialog: import("@playwright/test").Dialog) => {
      signOutPrompts++;
      await dialog.dismiss();
    };
    page.on("dialog", cancelSignOut);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    page.off("dialog", cancelSignOut);
    expect(signOutPrompts).toBe(1);
    await expect(editor).toHaveValue("Fictional unsaved draft must survive navigation.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    let sidebarPrompts = 0;
    const cancelSidebar = async (dialog: import("@playwright/test").Dialog) => {
      sidebarPrompts++;
      await dialog.dismiss();
    };
    page.on("dialog", cancelSidebar);
    await page
      .getByRole("navigation", { name: "Workspace navigation", exact: true })
      .getByRole("link", { name: "Availability", exact: true })
      .click();
    page.off("dialog", cancelSidebar);
    expect(sidebarPrompts).toBe(1);
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(editor).toHaveValue("Fictional unsaved draft must survive navigation.");
    await page.setViewportSize({ width: 1280, height: 900 });
    let navigationPrompts = 0;
    const dismissNavigation = async (dialog: import("@playwright/test").Dialog) => {
      navigationPrompts++;
      await dialog.dismiss();
    };
    page.on("dialog", dismissNavigation);
    await page.getByRole("link", { name: "Counselor area", exact: true }).click();
    page.off("dialog", dismissNavigation);
    expect(navigationPrompts).toBe(1);
    await expect(page).toHaveURL(`${baseURL}/counselor/appointments/${booking}#main-content`);
    await expect(editor).toHaveValue("Fictional unsaved draft must survive navigation.");
    let reloadPrompts = 0;
    const dismissReload = async (dialog: import("@playwright/test").Dialog) => {
      reloadPrompts++;
      await dialog.dismiss();
    };
    page.on("dialog", dismissReload);
    try {
      await page.reload({ timeout: 3000 });
    } catch {
      /* Browser cancels reload after discard is declined. */
    } finally {
      page.off("dialog", dismissReload);
    }
    expect(reloadPrompts).toBe(1);
    await expect(editor).toHaveValue("Fictional unsaved draft must survive navigation.");
    // Explicitly accepting discard returns to the persisted version, with no duplicate prompt.
    let acceptedPrompts = 0;
    const acceptDiscard = async (dialog: import("@playwright/test").Dialog) => {
      acceptedPrompts++;
      await dialog.accept();
    };
    page.on("dialog", acceptDiscard);
    await page.getByRole("button", { name: "Reload saved note", exact: true }).click();
    await expect(editor).toHaveValue("Fictional test note: first revision.");
    page.off("dialog", acceptDiscard);
    expect(acceptedPrompts).toBe(1);
    const stored = await service
      .from("session_notes")
      .select("*")
      .eq("booking_id", booking)
      .single();
    expect(stored.error).toBeNull();
    expect(JSON.stringify(stored.data)).not.toContain("Fictional test note");
    expect(stored.data!.envelope.key_id).toBeTruthy();
    const staleContext = await browser.newContext();
    const stale = await staleContext.newPage();
    try {
      await signIn(stale, counselorUser);
      await stale.goto(`/counselor/appointments/${booking}`);
      await expect(stale.getByLabel("Private session note")).toHaveValue(
        "Fictional test note: first revision.",
      );
      await editor.fill("Fictional test note: newer revision.");
      await page.getByLabel("I am using fictional test content only.").check();
      await page.getByRole("button", { name: "Save private note" }).click();
      await expect(page.getByRole("status")).toContainText(/version\s*2/);
      await stale.getByLabel("Private session note").fill("Fictional stale draft must remain.");
      await stale.getByLabel("I am using fictional test content only.").check();
      await stale.getByRole("button", { name: "Save private note" }).click();
      await expect(stale.getByRole("status")).toContainText("newer");
      await expect(stale.getByLabel("Private session note")).toHaveValue(
        "Fictional stale draft must remain.",
      );
    } finally {
      await staleContext.close();
    }
    await page.reload();
    await expect(editor).toHaveValue("Fictional test note: newer revision.");
    let currentText = "Fictional test note: newer revision.";
    const concurrentContext = await browser.newContext();
    const concurrent = await concurrentContext.newPage();
    try {
      await signIn(concurrent, counselorUser);
      await concurrent.goto(`/counselor/appointments/${booking}`);
      await expect(concurrent.getByLabel("Private session note")).toHaveValue(currentText);
      await editor.fill("Fictional concurrent draft A.");
      await concurrent.getByLabel("Private session note").fill("Fictional concurrent draft B.");
      await page.getByLabel("I am using fictional test content only.").check();
      await concurrent.getByLabel("I am using fictional test content only.").check();
      await Promise.all([
        page.getByRole("button", { name: "Save private note" }).click(),
        concurrent.getByRole("button", { name: "Save private note" }).click(),
      ]);
      await expect
        .poll(async () => {
          const messages = await Promise.all([
            page.getByRole("status").textContent(),
            concurrent.getByRole("status").textContent(),
          ]);
          return {
            saved: messages.filter((m) => /version 3/.test(m ?? "")).length,
            conflict: messages.filter((m) => (m ?? "").includes("newer")).length,
          };
        })
        .toEqual({ saved: 1, conflict: 1 });
      await discardAndReload();
      currentText = await editor.inputValue();
      expect(["Fictional concurrent draft A.", "Fictional concurrent draft B."]).toContain(
        currentText,
      );
    } finally {
      await concurrentContext.close();
    }
    // Rescheduling keeps the same encrypted note attached to the same booking.
    const customerActor = await signIn(page, customer);
    const slots = await customerActor.rpc("get_public_availability", { p_counselor_id: counselor });
    expect(slots.error).toBeNull();
    expect(
      (
        await customerActor.rpc("reschedule_booking", {
          p_booking_id: booking,
          p_counselor_id: counselor,
          p_start_at: slots.data![0].start_at,
        })
      ).error,
    ).toBeNull();
    await page.goto(`/counselor/appointments/${booking}`);
    await expect(page).toHaveURL(/unauthorized/);
    await expect(page.getByLabel("Private session note")).toHaveCount(0);
    for (const actor of [admin, other]) {
      await signIn(page, actor);
      await page.goto(`/counselor/appointments/${booking}`);
      await expect(
        page.getByRole("heading", {
          name: actor.id === admin.id ? "Access unavailable" : "404",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByLabel("Private session note")).toHaveCount(0);
      await expect(page.getByText(currentText, { exact: true })).toHaveCount(0);
    }
    await signIn(page, counselorUser);
    await page.goto(`/counselor/appointments/${booking}`);
    await expect(editor).toHaveValue(currentText);
    // A corrupted stored envelope must not be replaced by a forged save from an open editor.
    const current = await service
      .from("session_notes")
      .select("envelope")
      .eq("booking_id", booking)
      .single();
    expect(
      (
        await service
          .from("session_notes")
          .update({
            envelope: { ...current.data!.envelope, tag: Buffer.alloc(16).toString("base64") },
          })
          .eq("booking_id", booking)
      ).error,
    ).toBeNull();
    await editor.fill("Fictional overwrite should be refused.");
    await page.getByLabel("I am using fictional test content only.").check();
    await page.getByRole("button", { name: "Save private note" }).click();
    await expect(page.getByRole("status")).toContainText("unavailable");
    expect(
      (await service.from("session_notes").select("version").eq("booking_id", booking).single())
        .data!.version,
    ).toBe(3);
    await discardAndReload();
    await expect(page.getByText("Private notes are unavailable.", { exact: true })).toBeVisible();
    await expect(editor).toHaveCount(0);
    // Restore only this exact synthetic envelope to finish read/pagination acceptance.
    expect(
      (
        await service
          .from("session_notes")
          .update({ envelope: current.data!.envelope })
          .eq("booking_id", booking)
      ).error,
    ).toBeNull();
    await page.goto("/counselor?view=past");
    await expect(page.locator(`[data-booking-id="${past}"]`)).toContainText("Past appointment");
    await page
      .locator(`[data-booking-id="${past}"]`)
      .getByRole("link", { name: "Open appointment", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Session details", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: ".test-artifacts/phase8-note-mobile.png", fullPage: true });
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

test("disabled workspace preserves the basic counselor page without reading content keys", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.COUNSELOR_WORKSPACE_MODE !== "disabled", "Requires disabled workspace");
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
    user_metadata: { synthetic_disabled_workspace_test: true },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    localDb(
      `update public.profiles set role='counselor',email='disabled@example.test' where id='${id}';`,
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
    await page.goto("/counselor");
    await expect(page.getByRole("heading", { name: "Counselor area", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage availability" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open appointment" })).toHaveCount(0);
    await page.goto(`/counselor/appointments/${randomUUID()}`);
    await expect(
      page.getByText("Local session workspace is disabled.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Private session note")).toHaveCount(0);
  } finally {
    expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
