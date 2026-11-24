import { expect, test } from "@playwright/test";

test("landing page navigation and FAQs work on desktop and mobile", async ({ page }) => {
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "littlehello", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "A little hello can be the start of feeling better.",
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "FAQs", exact: true }).click();
    await expect(page).toHaveURL(/#faq$/);
    const question = page.getByText("Can I reschedule or cancel?", { exact: true });
    await question.click();
    await expect(page.getByText(/You may reschedule once/)).toBeVisible();
    await question.click();
    await expect(page.getByText(/You may reschedule once/)).toBeHidden();
    await page.getByRole("link", { name: "How it works", exact: true }).first().click();
    await expect(page).toHaveURL(/#how$/);
    await expect(page.getByRole("heading", { name: "How it works", exact: true })).toBeVisible();
    expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.getByRole("link", { name: "Find a counselor", exact: true }).click();
    await expect(page).toHaveURL(/\/counselors$/);
  }
});
