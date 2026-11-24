import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little hello can be the start of feeling better." }),
  ).toBeVisible();
});

test("local customer can sign in and is denied the admin area", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "Requires the local Supabase stack",
  );

  await page.goto("/login");
  await page.getByLabel("Preferred name (optional)").fill("Local Customer");
  await page.getByLabel("Indian mobile number").fill("+919000000001");
  await page.getByLabel("I confirm that I am 18 or older.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("One-time code")).toBeVisible();
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();

  const emailField = page.getByLabel("Email address");
  const contactEmailText = page
    .locator(".profile-details div")
    .filter({ hasText: "Contact email" });
  await expect(emailField.or(contactEmailText)).toBeVisible();

  let expectedEmail = "local.customer@example.test";
  if (await emailField.isVisible()) {
    await page.getByLabel("Email address").fill("local.customer@example.test");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("status")).toContainText("Contact email saved.");
    await page.getByRole("link", { name: "Continue to profile" }).click();
  } else {
    expectedEmail = (await contactEmailText.locator("dd").first().textContent()) ?? "";
  }

  await expect(contactEmailText).toContainText(expectedEmail);
  await expect(page.getByLabel("Preferred name", { exact: true })).toHaveValue("Local Customer");
  await expect(page.getByText("Account role")).toHaveCount(0);
  await page.getByLabel("Preferred name", { exact: true }).fill("Updated Local Customer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Preferred name", { exact: true })).toHaveValue(
    "Updated Local Customer",
  );
  await page.goto("/customer");
  await expect(page.getByText("Signed in as Updated Local Customer.")).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test("OTP request is blocked without adult attestation", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "Requires the local Supabase stack",
  );

  await page.goto("/login");
  await page.getByLabel("Indian mobile number").fill("+919000000002");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("status")).toContainText("18 or older");
  await expect(page.getByLabel("One-time code")).toHaveCount(0);
});
