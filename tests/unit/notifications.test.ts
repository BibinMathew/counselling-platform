import { expect, test } from "vitest";
import { readNotificationConfig } from "@/modules/notifications/config";
const local = {
  NODE_ENV: "test",
  NOTIFICATION_MODE: "simulator",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NOTIFICATION_APP_ORIGIN: "http://127.0.0.1:3000",
};
test("disabled mode requires no provider configuration", () => {
  expect(readNotificationConfig({}).mode).toBe("disabled");
});
test("simulator requires local runtime and loopback origins", () => {
  expect(readNotificationConfig(local).appOrigin).toBe("http://127.0.0.1:3000");
  for (const overrides of [
    { NODE_ENV: "production" },
    { NOTIFICATION_MODE: "smtp" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://host.supabase.co" },
    { NOTIFICATION_APP_ORIGIN: "https://example.com" },
    { NOTIFICATION_APP_ORIGIN: "http://user:pass@localhost:3000" },
    { NOTIFICATION_APP_ORIGIN: "http://localhost:3000/path" },
  ])
    expect(() => readNotificationConfig({ ...local, ...overrides })).toThrow();
});

test("notification queue paging keeps failed recovery accessible", async () => {
  const { notificationPage } = await import("@/modules/notifications/model");
  expect(notificationPage({ page: "2", status: "failed" })).toEqual({
    page: 2,
    failedOnly: true,
    from: 200,
    to: 299,
  });
  expect(notificationPage({ page: "-1", status: "forged" })).toEqual({
    page: 0,
    failedOnly: false,
    from: 0,
    to: 99,
  });
  expect(notificationPage({ page: "x" })).toEqual({ page: 0, failedOnly: false, from: 0, to: 99 });
});
