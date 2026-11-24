import { expect, test } from "@playwright/test";

test("local counselor showcase filters categories and keeps demo profiles non-bookable", async ({
  page,
}) => {
  test.skip(process.env.CATALOG_DEMO_MODE !== "local", "Requires local catalog demo mode");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const categories = page.getByRole("navigation", { name: "Counselor categories" });
  await expect(categories.getByRole("link")).toHaveCount(5);
  await expect(categories.getByRole("link", { name: "All", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByText(
      "UX preview only: these profiles are fictional and do not represent real therapists.",
    ),
  ).toBeVisible();
  await expect(page.locator(".counselor-card")).toHaveCount(4);
  await expect(page.locator(".home-profile-demo")).toHaveCount(4);
  await expect(page.locator(".home-profile img")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Book session" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View profile" })).toHaveCount(4);
  const firstCard = page.locator(".home-profile").first();
  await expect(firstCard.getByText("Illustrative profile content only.")).toBeVisible();
  await expect(firstCard.getByText("Malayalam, English")).toBeVisible();
  const mobileCards = await page.locator(".home-profile").evaluateAll((cards) =>
    cards.slice(0, 2).map((card) => ({
      left: card.getBoundingClientRect().left,
      top: card.getBoundingClientRect().top,
    })),
  );
  expect(mobileCards[1].left).toBe(mobileCards[0].left);
  expect(mobileCards[1].top).toBeGreaterThan(mobileCards[0].top);

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopCards = await page.locator(".home-profile").evaluateAll((cards) =>
    cards.slice(0, 3).map((card) => ({
      left: card.getBoundingClientRect().left,
      top: card.getBoundingClientRect().top,
    })),
  );
  expect(desktopCards[1].left).toBeGreaterThan(desktopCards[0].left);
  expect(desktopCards[2].left).toBeGreaterThan(desktopCards[1].left);
  expect(desktopCards[2].top).toBe(desktopCards[0].top);

  await page.setViewportSize({ width: 390, height: 844 });
  await categories.getByRole("link", { name: "Clinical Psychologist" }).click();
  await expect(page).toHaveURL(/category=clinical_psychologist/);
  await expect(page.locator(".counselor-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Demo Counselor 02" })).toBeVisible();
  await expect(page.getByRole("link", { name: "All counselors" })).toBeVisible();
  await expect(categories.getByRole("link", { name: "Clinical Psychologist" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(categories.getByRole("link", { name: "All", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await categories.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/#counsellors$/);
  await expect(page.locator(".counselor-card")).toHaveCount(4);
  await expect(categories.getByRole("link", { name: "All", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const [label, category, counselor] of [
    ["Sexual Health", "sexual_health", "Demo Counselor 03"],
    ["Psychiatrist", "psychiatrist", "Demo Counselor 04"],
  ]) {
    await categories.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`category=${category}`));
    await expect(categories.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".counselor-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: counselor })).toBeVisible();
  }

  await categories.getByRole("link", { name: "Clinical Psychologist" }).click();
  await expect(page.locator(".counselor-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Demo Counselor 02" })).toBeVisible();

  await page.getByRole("link", { name: "View profile" }).click();
  await expect(page.getByRole("heading", { name: "Demo Counselor 02" })).toBeVisible();
  await expect(
    page.getByText(
      "Fictional UX sample only. This is not a real therapist and bookings are unavailable.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available times" })).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
});

test("category links are keyboard accessible and wrap without overflowing", async ({ page }) => {
  test.skip(process.env.CATALOG_DEMO_MODE !== "local", "Requires local catalog demo mode");
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const categories = page.getByRole("navigation", { name: "Counselor categories" });
    const all = categories.getByRole("link", { name: "All", exact: true });
    const consultant = categories.getByRole("link", { name: "Consultant Psychologist" });
    await all.focus();
    await page.keyboard.press("Tab");
    await expect(consultant).toBeFocused();
    expect(await consultant.evaluate((link) => getComputedStyle(link).outlineStyle)).not.toBe(
      "none",
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/category=consultant_psychologist/);
    await expect(consultant).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".counselor-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Demo Counselor 01" })).toBeVisible();
    expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const bounds = await categories.getByRole("link").evaluateAll((links) =>
      links.map((link) => ({
        left: link.getBoundingClientRect().left,
        right: link.getBoundingClientRect().right,
      })),
    );
    expect(bounds.every(({ left, right }) => left >= 0 && right <= width)).toBe(true);
  }
});
