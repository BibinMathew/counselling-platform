import { expect, test } from "vitest";
import { runStagingCommand } from "../../scripts/staging-tools.mjs";
const env = {
  APP_ENV: "staging",
  VERCEL_ENV: "preview",
  VERCEL_URL: "littlehello-preview.vercel.app",
  STAGING_APP_ORIGIN: "https://littlehello-preview.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://wajqgyhugvcorgxgrdlv.supabase.co",
  STAGING_ALLOWED_USER_IDS: "fa100000-0000-4000-8000-000000000001",
  STAGING_ALLOWED_PHONES: "+919000001001,+919000001002,+919000001003",
  SUPABASE_SERVICE_ROLE_KEY: "server-only",
  STAGING_TARGET_CONFIRM: "wajqgyhugvcorgxgrdlv",
  STAGING_SCHEMA_VERIFIED: "20261127000000",
  STAGING_AUTH_LOCKED: "yes",
};
test("wrong target, missing confirmation and unknown commands abort before any network", async () => {
  for (const [command, change] of [
    ["seed", { STAGING_TARGET_CONFIRM: "" }],
    ["seed", { NEXT_PUBLIC_SUPABASE_URL: "https://wrong.supabase.co" }],
    ["seed", { STAGING_AUTH_LOCKED: "" }],
    ["erase", {}],
  ] as const) {
    let calls = 0;
    await expect(
      runStagingCommand(command, { ...env, ...change }, async () => {
        calls++;
        return new Response();
      }),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  }
});
test("read-only preflight never writes or emits account bodies", async () => {
  const calls: { url: string; method: string }[] = [];
  const result = await runStagingCommand("check", env, async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET" });
    return Response.json(url.includes("/auth/") ? { users: [] } : [], {
      headers: { "content-range": "*/0" },
    });
  });
  expect(calls.length).toBeGreaterThan(2);
  expect(calls.every((c) => ["GET", "HEAD"].includes(c.method))).toBe(true);
  expect(result).toEqual({ status: "ready", users: 0 });
});
test("seed can retry after partial provisioning and never adopts unrelated accounts", async () => {
  const users: Record<string, unknown>[] = [];
  let creates = 0;
  const transport = async (url: string, init: RequestInit) => {
    if (url.includes("/auth/v1/admin/users")) {
      if (init.method !== "POST") return Response.json({ users });
      creates++;
      const input = JSON.parse(String(init.body));
      const record = { ...input, id: `fa100000-0000-4000-8000-00000000000${creates}` };
      users.push(record);
      return Response.json(record);
    }
    return Response.json([], {
      headers: { "content-range": url.includes("/profiles?") ? "*/" + users.length : "*/0" },
    });
  };
  await runStagingCommand("seed", env, transport);
  await runStagingCommand("seed", env, transport);
  expect(creates).toBe(3);
  users[0].app_metadata = {};
  await expect(runStagingCommand("seed", env, transport)).rejects.toThrow();
  expect(creates).toBe(3);
});
test("manual job runner uses exact preview origin and bounded bearer-authenticated POST without redirects", async () => {
  let called = false;
  const result = await runStagingCommand(
    "notifications",
    {
      ...env,
      NOTIFICATION_WORKER_SECRET: "a".repeat(32),
      VERCEL_AUTOMATION_BYPASS_SECRET: "b".repeat(32),
    },
    async (url: string, init: RequestInit) => {
      called = true;
      expect(url).toBe("https://littlehello-preview.vercel.app/api/notifications/dispatch");
      expect(init.method).toBe("POST");
      expect(init.redirect).toBe("error");
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer " + "a".repeat(32));
      return Response.json({ checked: 2, delivered: 2, failed: 0 });
    },
  );
  expect(called).toBe(true);
  expect(result).toEqual({ checked: 2, delivered: 2, failed: 0 });
});
