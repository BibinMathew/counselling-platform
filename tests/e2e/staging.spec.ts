import { expect, test } from "@playwright/test";
test("production-mode staging refuses an unapproved local origin before auth or jobs", async ({
  request,
}) => {
  test.skip(
    process.env.APP_ENV !== "staging",
    "Run separately against the staging-configured production build",
  );
  for (const path of ["/login", "/profile", "/counselors"]) {
    const result = await request.get(path);
    expect(result.status()).toBe(403);
  }
  for (const path of [
    "/api/payments/simulate",
    "/api/payments/webhook",
    "/api/payments/reconcile",
    "/api/notifications/dispatch",
  ]) {
    const result = await request.post(path, { data: {} });
    expect(result.status()).toBe(403);
  }
});
