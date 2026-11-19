import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Space to pause. Someone to talk to." }),
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
  const contactEmailText = page.getByText(/^Contact email: .+$/);
  await expect(emailField.or(contactEmailText)).toBeVisible();

  let expectedEmail = "local.customer@example.test";
  if (await emailField.isVisible()) {
    await page.getByLabel("Email address").fill("local.customer@example.test");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(contactEmailText).toContainText(expectedEmail);
  } else {
    expectedEmail = (await contactEmailText.textContent())?.replace("Contact email: ", "") ?? "";
  }

  await expect(page.getByText(`Contact email: ${expectedEmail}`)).toBeVisible();
  await expect(page.getByText("Preferred name: Local Customer")).toBeVisible();
  await expect(page.getByText("Role: customer")).toBeVisible();
  await page.getByLabel("Preferred name", { exact: true }).fill("Updated Local Customer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Preferred name: Updated Local Customer")).toBeVisible();
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
