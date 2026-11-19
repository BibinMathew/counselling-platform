import { expect, test } from "vitest";
import { handleNotificationRequest } from "@/modules/notifications/http";
const env = {
  NODE_ENV: "test",
  NOTIFICATION_MODE: "simulator",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NOTIFICATION_APP_ORIGIN: "http://localhost:3000",
  NOTIFICATION_WORKER_SECRET: "a".repeat(32),
};
const request = (token = "a".repeat(32)) =>
  new Request("http://localhost/api/notifications/dispatch", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: "attacker", origin: "https://evil.test" }),
  });
test("worker rejects missing, short and incorrect secrets", async () => {
  for (const token of ["", "bad", "b".repeat(32)])
    expect(
      (
        await handleNotificationRequest(request(token), env, async () => {
          throw new Error("must not run");
        })
      ).status,
    ).toBe(401);
  expect(
    (
      await handleNotificationRequest(
        request("short"),
        { ...env, NOTIFICATION_WORKER_SECRET: "short" },
        async () => {
          throw 0;
        },
      )
    ).status,
  ).toBe(401);
});
test("disabled mode is paused without invoking worker", async () => {
  const response = await handleNotificationRequest(
    request(),
    { ...env, NOTIFICATION_MODE: "disabled" },
    async () => {
      throw new Error("must not run");
    },
  );
  expect(await response.json()).toEqual({ paused: true, checked: 0, delivered: 0, failed: 0 });
});
test("production simulator is rejected and errors stay generic", async () => {
  const response = await handleNotificationRequest(
    request(),
    { ...env, NODE_ENV: "production" },
    async () => {
      throw new Error("sensitive");
    },
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("sensitive");
});
test("body cannot select recipients or app origin", async () => {
  const response = await handleNotificationRequest(request(), env, async (...args: unknown[]) => {
    expect(args).toEqual([]);
    return { checked: 1, delivered: 1, failed: 0 };
  });
  expect(await response.json()).toEqual({ checked: 1, delivered: 1, failed: 0 });
});

test("valid local worker request returns a safe retryable error after database failure", async () => {
  let invoked = false;
  const response = await handleNotificationRequest(request(), env, async () => {
    invoked = true;
    throw new Error("database connection failed: secret-connection-string-and-token");
  });
  expect(invoked).toBe(true);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Notification processing unavailable" });
  const recovered = await handleNotificationRequest(request(), env, async () => ({
    checked: 1,
    delivered: 1,
    failed: 0,
  }));
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual({ checked: 1, delivered: 1, failed: 0 });
});
