import { execFileSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("admin manages a counselor profile visible to visitors", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "Requires local Supabase",
  );
  const status = JSON.parse(
    execFileSync("supabase", ["status", "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as Record<string, string>;
  const localUrl = new URL(status.API_URL);
  if (
    !["127.0.0.1", "localhost"].includes(localUrl.hostname) ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== status.API_URL
  )
    throw new Error("Catalog fixtures require the local Supabase stack.");
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = randomUUID();
  const phone = () => `+9198${randomInt(10000000, 99999999)}`;
  const accounts: string[] = [];
  let adminId = "";
  let counselorId = "";
  try {
    const adminPhone = phone();
    const admin = await service.auth.admin.createUser({
      phone: adminPhone,
      password,
      phone_confirm: true,
    });
    if (admin.error || !admin.data.user) throw new Error("Unable to create synthetic admin.");
    adminId = admin.data.user.id;
    accounts.push(adminId);
    const counselorPhone = phone();
    const counselor = await service.auth.admin.createUser({
      phone: counselorPhone,
      password,
      phone_confirm: true,
    });
    if (counselor.error || !counselor.data.user)
      throw new Error("Unable to create synthetic counselor.");
    counselorId = counselor.data.user.id;
    accounts.push(counselorId);
    if (![adminId, counselorId].every((id) => /^[0-9a-f-]{36}$/.test(id)))
      throw new Error("Invalid synthetic account ID.");
    execFileSync(
      "supabase",
      [
        "db",
        "query",
        `do $$ begin update public.profiles set role = 'admin', email = 'admin@example.test' where id = '${adminId}'; update public.profiles set role = 'counselor', email = 'counselor@example.test' where id = '${counselorId}'; end $$;`,
      ],
      { stdio: "ignore" },
    );

    const cookieValues = new Map<string, string>();
    const client = createServerClient(status.API_URL, status.PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => Array.from(cookieValues, ([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => cookieValues.set(name, value)),
      },
    });
    const login = await client.auth.signInWithPassword({ phone: adminPhone, password });
    if (login.error || !baseURL) throw new Error("Unable to sign in synthetic admin.");
    await page
      .context()
      .addCookies(Array.from(cookieValues, ([name, value]) => ({ name, value, url: baseURL })));
    await page.goto("/admin/availability");
    await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
    await page.getByLabel("Minimum notice (minutes)").fill("2880");
    await page.getByLabel("Booking window (days)").fill("1");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Check the scheduling settings and booking window.")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Scheduling settings saved.")).toBeVisible();
    await page.goto("/admin/counselors");
    await page.getByText("Add counselor", { exact: true }).click();
    const create = page.locator("details").filter({ hasText: "Add counselor" });
    await create.getByLabel("Counselor account ID").fill(counselorId);
    await create.getByLabel("Display name").fill("Catalog Test Counselor");
    await create.getByLabel("Biography").fill("A synthetic counselor profile.");
    await create.getByLabel("Qualifications").fill("Test qualification");
    await create.getByLabel("Experience").fill("Five years");
    await create.getByLabel("Specializations").fill("Stress");
    await create.getByLabel("Languages").fill("English");
    await create.getByLabel("Approved image URL").fill("https://example.test/portrait.jpg");
    await create.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Catalog Test Counselor (Draft)")).toBeVisible();

    const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await visitor.goto("/counselors");
      await expect(visitor.getByText("Catalog Test Counselor")).toHaveCount(0);
      await page.getByText("Catalog Test Counselor (Draft)").click();
      const editor = page.locator("details").filter({ hasText: "Catalog Test Counselor (Draft)" });
      await editor.getByLabel("Published").check();
      await editor.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByText("Catalog Test Counselor (Published)")).toBeVisible();
      const adminEditor = page
        .locator("details")
        .filter({ hasText: "Catalog Test Counselor (Published)" });
      if (!(await adminEditor.evaluate((element) => (element as HTMLDetailsElement).open)))
        await adminEditor.locator("summary").click();
      await adminEditor.getByRole("link", { name: "Manage availability" }).click();
      await expect(
        page.getByRole("heading", { name: "Catalog Test Counselor: availability" }),
      ).toBeVisible();
      await page.getByText("Add weekly hours", { exact: true }).click();
      const adminWeekly = page.locator("details").filter({ hasText: "Add weekly hours" });
      await adminWeekly.getByLabel("Day").selectOption("2");
      await adminWeekly.getByLabel("Start time").fill("16:00");
      await adminWeekly.getByLabel("End time").fill("14:00");
      await adminWeekly.getByRole("button", { name: "Save weekly hours" }).click();
      await expect(
        adminWeekly.getByText("Enter a valid day and a start time before the end time."),
      ).toBeVisible();
      await adminWeekly.getByLabel("Day").selectOption("2");
      await adminWeekly.getByLabel("Start time").fill("14:00");
      await adminWeekly.getByLabel("End time").fill("16:00");
      await adminWeekly.getByRole("button", { name: "Save weekly hours" }).click();
      await expect(page.getByText("Tuesday · 14:00–16:00")).toBeVisible();
      const originalWeekly = page.locator("details").filter({ hasText: "Tuesday · 14:00–16:00" });
      await originalWeekly.locator("summary").click();
      await originalWeekly.getByLabel("Start time").fill("15:00");
      await originalWeekly.getByLabel("End time").fill("17:00");
      await originalWeekly.getByRole("button", { name: "Save weekly hours" }).click();
      const editedWeekly = page.locator("details").filter({ hasText: "Tuesday · 15:00–17:00" });
      await expect(editedWeekly).toBeVisible();
      if (!(await editedWeekly.evaluate((element) => (element as HTMLDetailsElement).open)))
        await editedWeekly.locator("summary").click();
      page.once("dialog", (dialog) => dialog.accept());
      await editedWeekly.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(editedWeekly).toHaveCount(0);
      const adminDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Date.now() + 72 * 60 * 60 * 1000));
      await page.getByText("Add date", { exact: true }).click();
      const adminDateForm = page.locator("details").filter({ hasText: "Add date" });
      await adminDateForm.getByLabel("Date", { exact: true }).fill(adminDate);
      await adminDateForm.getByLabel("Start time").fill("09:00");
      await adminDateForm.getByLabel("End time").fill("10:00");
      await adminDateForm.getByRole("button", { name: "Save date" }).click();
      const adminDateEntry = page
        .locator("details")
        .filter({ hasText: `${adminDate} · Extra opening` });
      await expect(adminDateEntry).toBeVisible();
      await adminDateEntry.locator("summary").click();
      await adminDateEntry.getByLabel("Start time").fill("10:00");
      await adminDateEntry.getByLabel("End time").fill("12:00");
      await adminDateEntry.getByRole("button", { name: "Save date" }).click();
      await expect(adminDateEntry.locator("summary")).toContainText("10:00–12:00");
      if (!(await adminDateEntry.evaluate((element) => (element as HTMLDetailsElement).open)))
        await adminDateEntry.locator("summary").click();
      page.once("dialog", (dialog) => dialog.accept());
      await adminDateEntry.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(adminDateEntry).toHaveCount(0);
      await page.goto("/admin/counselors");
      await visitor.reload();
      await expect(visitor.getByRole("heading", { name: "Catalog Test Counselor" })).toBeVisible();
      await visitor
        .getByRole("article")
        .filter({ has: visitor.getByRole("heading", { name: "Catalog Test Counselor" }) })
        .getByRole("link", { name: "View profile" })
        .click();
      await expect(visitor.getByText("A synthetic counselor profile.")).toBeVisible();
      await expect(visitor.getByText("45-minute session · ₹699")).toBeVisible();
      await expect(visitor.locator("body")).toHaveJSProperty("scrollWidth", 390);

      const counselorPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        const counselorCookies = new Map<string, string>();
        const counselorClient = createServerClient(status.API_URL, status.PUBLISHABLE_KEY, {
          cookies: {
            getAll: () => Array.from(counselorCookies, ([name, value]) => ({ name, value })),
            setAll: (cookies) =>
              cookies.forEach(({ name, value }) => counselorCookies.set(name, value)),
          },
        });
        const counselorLogin = await counselorClient.auth.signInWithPassword({
          phone: counselorPhone,
          password,
        });
        if (counselorLogin.error) throw new Error("Unable to sign in synthetic counselor.");
        await counselorPage
          .context()
          .addCookies(
            Array.from(counselorCookies, ([name, value]) => ({ name, value, url: baseURL })),
          );
        await counselorPage.goto("/counselor/availability");
        await expect(
          counselorPage.getByRole("heading", { name: "Your availability" }),
        ).toBeVisible();
        await expect(counselorPage.locator(".calendar-grid")).toHaveCSS("display", "grid");
        const testDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(Date.now() + 48 * 60 * 60 * 1000));
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const dateLabel = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "full",
        }).format(new Date(`${testDate}T12:00:00+05:30`));
        const weekdays = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const weeklyDay = (new Date(`${testDate}T12:00:00Z`).getUTCDay() + 1) % 7;
        const weeklyLabel = `${weekdays[weeklyDay]} · 14:00–16:00`;
        await counselorPage.getByText("Add weekly hours", { exact: true }).click();
        const weeklyForm = counselorPage.locator("details").filter({ hasText: "Add weekly hours" });
        await weeklyForm.getByLabel("Day").selectOption(String(weeklyDay));
        await weeklyForm.getByLabel("Start time").fill("14:00");
        await weeklyForm.getByLabel("End time").fill("16:00");
        await weeklyForm.getByRole("button", { name: "Save weekly hours" }).click();
        await expect(counselorPage.getByText(weeklyLabel)).toBeVisible();
        if (testDate.slice(0, 7) !== today.slice(0, 7))
          await counselorPage.getByRole("button", { name: "Next month" }).click();
        await counselorPage.getByRole("button", { name: new RegExp(`^${testDate}`) }).click();
        await expect(counselorPage.getByText(`Selected date: ${testDate}`)).toBeVisible();
        await expect(counselorPage.locator("body")).toHaveJSProperty("scrollWidth", 390);
        await counselorPage.getByText("Add date", { exact: true }).click();
        const dateForm = counselorPage.locator("details").filter({ hasText: "Add date" });
        await expect(dateForm.getByLabel("Date", { exact: true })).toHaveValue(testDate);
        await dateForm.getByLabel("Start time").fill("10:00");
        await dateForm.getByLabel("End time").fill("13:00");
        await dateForm.getByRole("button", { name: "Save date" }).click();
        await expect(counselorPage.getByText(`${testDate} · Extra opening`)).toBeVisible();
        await dateForm.getByLabel("Date", { exact: true }).fill(testDate);
        await dateForm.getByLabel("Type").selectOption("blocked");
        await dateForm.getByLabel("Start time").fill("11:30");
        await dateForm.getByLabel("End time").fill("12:00");
        await dateForm.getByRole("button", { name: "Save date" }).click();
        await expect(counselorPage.getByText(`${testDate} · Blocked`)).toBeVisible();
        await visitor.reload();
        const dateSection = visitor
          .locator("section")
          .filter({ has: visitor.getByRole("heading", { name: dateLabel }) });
        await expect(dateSection.locator("li")).toHaveCount(2);
        await expect(dateSection).toContainText("10:00");
        await expect(dateSection).toContainText("12:00");
        await expect(visitor.locator("body")).toHaveJSProperty("scrollWidth", 390);
        for (const label of [`${testDate} · Extra opening`, `${testDate} · Blocked`, weeklyLabel]) {
          const entry = counselorPage.locator("details").filter({ hasText: label });
          await entry.locator("summary").click();
          counselorPage.once("dialog", (dialog) => dialog.accept());
          await entry.getByRole("button", { name: "Delete", exact: true }).click();
          await expect(entry).toHaveCount(0);
        }
        await visitor.reload();
        await expect(visitor.getByRole("heading", { name: dateLabel })).toHaveCount(0);
      } finally {
        await counselorPage.close();
      }

      const publishedEditor = page
        .locator("details")
        .filter({ hasText: "Catalog Test Counselor (Published)" });
      if (!(await publishedEditor.evaluate((element) => (element as HTMLDetailsElement).open)))
        await publishedEditor.locator("summary").click();
      page.once("dialog", (dialog) => dialog.accept());
      await publishedEditor.getByRole("button", { name: "Delete profile" }).click();
      await expect(page.getByText("Catalog Test Counselor (Published)")).toHaveCount(0);
      await visitor.reload();
      await expect(visitor.getByRole("heading", { name: "Catalog Test Counselor" })).toHaveCount(0);
    } finally {
      await visitor.close();
    }
  } finally {
    try {
      if (adminId && counselorId)
        execFileSync(
          "supabase",
          [
            "db",
            "query",
            `do $$ begin perform set_config('request.jwt.claim.sub', '${adminId}', true); delete from public.availability_rules where counselor_id in (select id from public.counselors where profile_id = '${counselorId}'); delete from public.availability_exceptions where counselor_id in (select id from public.counselors where profile_id = '${counselorId}'); delete from public.availability_audit_events where actor_user_id in ('${adminId}', '${counselorId}'); delete from public.counselors where profile_id = '${counselorId}'; delete from public.counselor_catalog_audit_events where actor_user_id = '${adminId}'; end $$;`,
          ],
          { stdio: "ignore" },
        );
    } finally {
      for (const id of accounts) {
        const result = await service.auth.admin.deleteUser(id);
        if (result.error) throw new Error("Unable to remove a synthetic test account.");
      }
    }
  }
});
