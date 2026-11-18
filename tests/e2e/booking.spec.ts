import { localDb, localSettings } from "../helpers/local-supabase";
import { randomInt, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("customers can hold and reschedule without concurrent conflicts", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60000);
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "Requires local Supabase",
  );
  const status = localSettings();
  if (
    !["127.0.0.1", "localhost"].includes(new URL(status.API_URL).hostname) ||
    status.API_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !baseURL
  )
    throw new Error("Booking fixtures require local Supabase.");
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = randomUUID();
  const accounts: { id: string; phone: string }[] = [];
  const counselorIds = [randomUUID(), randomUUID()];
  try {
    for (let index = 0; index < 6; index += 1) {
      const phone = `+9197${randomInt(10000000, 99999999)}`;
      const created = await service.auth.admin.createUser({ phone, password, phone_confirm: true });
      if (created.error || !created.data.user)
        throw new Error("Unable to create synthetic booking account.");
      accounts.push({ id: created.data.user.id, phone });
    }
    const [admin, counselorOne, counselorTwo, customerOne, customerTwo, customerThree] = accounts;
    if (
      ![...accounts.map((account) => account.id), ...counselorIds].every((id) =>
        /^[0-9a-f-]{36}$/.test(id),
      )
    )
      throw new Error("Invalid synthetic identifier.");
    localDb(`do $$ begin
      update public.profiles set role = 'admin', email = 'admin@example.test' where id = '${admin.id}';
      update public.profiles set role = 'counselor', email = 'counselor@example.test' where id in ('${counselorOne.id}', '${counselorTwo.id}');
      update public.profiles set email = 'customer@example.test' where id in ('${customerTwo.id}', '${customerThree.id}');
      perform set_config('request.jwt.claim.sub', '${admin.id}', true);
      insert into public.counselors (id, profile_id, display_name, bio, qualifications, experience, specialties, languages, photo_url, published) values
        ('${counselorIds[0]}', '${counselorOne.id}', 'Booking Test One', 'Bio', 'Degree', 'Experience', 'Stress', 'English', 'https://example.test/one.jpg', true),
        ('${counselorIds[1]}', '${counselorTwo.id}', 'Booking Test Two', 'Bio', 'Degree', 'Experience', 'Stress', 'English', 'https://example.test/two.jpg', true);
      perform public.save_availability_exception('${counselorIds[0]}', null, (now() at time zone 'Asia/Kolkata')::date + 2, 'opening', false, '10:00', '14:00');
      perform public.save_availability_exception('${counselorIds[1]}', null, (now() at time zone 'Asia/Kolkata')::date + 2, 'opening', false, '10:00', '14:00');
    end $$;`);

    const customerClients = [customerTwo, customerThree].map(() =>
      createClient(status.API_URL, status.PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    for (let index = 0; index < customerClients.length; index += 1) {
      const login = await customerClients[index].auth.signInWithPassword({
        phone: [customerTwo, customerThree][index].phone,
        password,
      });
      if (login.error) throw new Error("Unable to sign in synthetic customer.");
    }
    const publicClient = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const available = await publicClient.rpc("get_public_availability", {
      p_counselor_id: counselorIds[0],
    });
    if (available.error || !available.data || available.data.length < 4)
      throw new Error("Synthetic availability was not generated.");
    const firstStart = available.data[0].start_at as string;
    const conflictStart = available.data[1].start_at as string;
    const replacementStart = available.data[2].start_at as string;
    const sameCustomerStart = available.data[3].start_at as string;

    await page.goto(`/counselors/${counselorIds[0]}`);
    await page.locator(".available-day li a").first().click();
    await expect(page).toHaveURL(/\/login\?next=/);
    const next = new URL(page.url()).searchParams.get("next");
    expect(next).toContain("/book?");
    const cookies = new Map<string, string>();
    const loginClient = createServerClient(status.API_URL, status.PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
      },
    });
    const login = await loginClient.auth.signInWithPassword({ phone: customerOne.phone, password });
    if (login.error) throw new Error("Unable to sign in synthetic first-time customer.");
    await page
      .context()
      .addCookies(Array.from(cookies, ([name, value]) => ({ name, value, url: baseURL })));
    await page.goto(next!, { timeout: 10000 });
    await expect(page).toHaveURL(/\/complete-profile\?next=/);
    await page.getByLabel("Email address").fill("first.customer@example.test");
    await page.getByRole("button", { name: "Continue" }).click({ timeout: 10000 });
    const continueLink = page.getByRole("link", { name: "Continue to selected time" });
    const selectedHeading = page.getByRole("heading", { name: "Selected time" });
    await expect(continueLink.or(selectedHeading)).toBeVisible();
    if (await continueLink.isVisible()) await continueLink.click({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Selected time" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await expect(page.getByRole("button", { name: "Hold this time" })).toHaveCSS(
      "background-color",
      "rgb(23, 102, 90)",
    );
    await page.getByRole("button", { name: "Hold this time" }).click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(
      page.getByText(/This is not a confirmed appointment until payment is verified/),
    ).toBeVisible();

    const races = await Promise.all(
      customerClients.map((client) =>
        client.rpc("create_booking_hold", {
          p_counselor_id: counselorIds[0],
          p_start_at: conflictStart,
        }),
      ),
    );
    expect(races.filter((result) => !result.error)).toHaveLength(1);
    expect(races.filter((result) => result.error)).toHaveLength(1);
    const winner = customerClients[races.findIndex((result) => !result.error)];
    const overlapping = await winner.rpc("create_booking_hold", {
      p_counselor_id: counselorIds[1],
      p_start_at: conflictStart,
    });
    expect(overlapping.error?.code).toBe("23P01");
    const otherCustomer = customerClients[races.findIndex((result) => result.error)];
    const customerRaces = await Promise.all(
      counselorIds.map((id) =>
        otherCustomer.rpc("create_booking_hold", {
          p_counselor_id: id,
          p_start_at: sameCustomerStart,
        }),
      ),
    );
    expect(customerRaces.filter((result) => !result.error)).toHaveLength(1);
    expect(customerRaces.filter((result) => result.error?.code === "23P01")).toHaveLength(1);

    const actor = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminLogin = await actor.auth.signInWithPassword({ phone: admin.phone, password });
    if (adminLogin.error) throw new Error("Unable to sign in synthetic administrator.");
    const blocked = await actor.rpc("save_availability_exception", {
      p_counselor_id: counselorIds[0],
      p_id: null,
      p_local_date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(firstStart)),
      p_kind: "blocked",
      p_all_day: true,
      p_start_time: null,
      p_end_time: null,
    });
    expect(blocked.error?.code).toBe("23514");
    const conflictingChanges = await Promise.all([
      actor.rpc("save_availability_exception", {
        p_counselor_id: counselorIds[1],
        p_id: null,
        p_local_date: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(conflictStart)),
        p_kind: "blocked",
        p_all_day: true,
        p_start_time: null,
        p_end_time: null,
      }),
      loginClient.rpc("create_booking_hold", {
        p_counselor_id: counselorIds[1],
        p_start_at: conflictStart,
      }),
    ]);
    expect(conflictingChanges.filter((result) => !result.error)).toHaveLength(1);
    expect(conflictingChanges.filter((result) => result.error)).toHaveLength(1);

    localDb(
      `update public.bookings set status = 'confirmed' where customer_id = '${customerOne.id}' and counselor_id = '${counselorIds[0]}' and status = 'held'`,
    );
    await page.reload();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Reschedule" }).click({ timeout: 10000 });
    await page
      .locator(`.available-day li a[href*="${encodeURIComponent(replacementStart)}"]`)
      .click({ timeout: 10000 });
    await page.getByRole("button", { name: "Reschedule appointment" }).click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByRole("link", { name: "Reschedule" })).toHaveCount(0);
  } finally {
    if (accounts.length > 0) {
      const accountIds = accounts.map((account) => `'${account.id}'`).join(", ");
      localDb(`do $$ begin
        perform set_config('request.jwt.claim.sub', '${accounts[0].id}', true);
        delete from public.booking_audit_events where actor_user_id in (${accountIds}) or booking_id in (select id from public.bookings where counselor_id in ('${counselorIds[0]}', '${counselorIds[1]}'));
        delete from public.bookings where counselor_id in ('${counselorIds[0]}', '${counselorIds[1]}');
        delete from public.availability_exceptions where counselor_id in ('${counselorIds[0]}', '${counselorIds[1]}');
        delete from public.availability_audit_events where actor_user_id in (${accountIds});
        delete from public.counselors where id in ('${counselorIds[0]}', '${counselorIds[1]}');
        delete from public.counselor_catalog_audit_events where actor_user_id in (${accountIds});
      end $$;`);
      for (const account of accounts) {
        const deleted = await service.auth.admin.deleteUser(account.id);
        if (deleted.error) throw new Error("Unable to remove a synthetic booking account.");
      }
    }
  }
});
