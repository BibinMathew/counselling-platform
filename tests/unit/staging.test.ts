import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readPaymentConfig } from "@/modules/payments/config";
import { readNotificationConfig } from "@/modules/notifications/config";
import { readWorkspaceMode } from "@/lib/private-content/config";
import { readFeedbackAdminMode } from "@/lib/local-features";

const user = "fa100000-0000-4000-8000-000000000001";
const preview = {
  APP_ENV: "staging",
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_URL: "littlehello-preview.vercel.app",
  STAGING_APP_ORIGIN: "https://littlehello-preview.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://wajqgyhugvcorgxgrdlv.supabase.co",
  STAGING_ALLOWED_USER_IDS: user,
  STAGING_ALLOWED_PHONES: "+919000001001",
  PAYMENT_MODE: "simulator",
  PAYMENT_SIMULATOR_SECRET: "a".repeat(32),
  NOTIFICATION_MODE: "simulator",
  NOTIFICATION_APP_ORIGIN: "https://littlehello-preview.vercel.app",
  COUNSELOR_WORKSPACE_MODE: "staging",
  FEEDBACK_ADMIN_MODE: "staging",
};
test("explicit hosted preview supports fake payments and private synthetic workspaces in a production build", () => {
  expect(readPaymentConfig(preview).mode).toBe("simulator");
  expect(readNotificationConfig(preview).appOrigin).toBe("https://littlehello-preview.vercel.app");
  expect(readWorkspaceMode(preview)).toBe("staging");
  expect(readFeedbackAdminMode(preview)).toBe("staging");
});
test.each([
  { APP_ENV: "production" },
  { APP_ENV: "stagng" },
  { APP_ENV: undefined },
  { VERCEL_ENV: "production" },
  { VERCEL_ENV: undefined },
  { NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" },
  { NEXT_PUBLIC_SUPABASE_URL: "https://wajqgyhugvcorgxgrdlv.supabase.co.evil.test" },
  { NEXT_PUBLIC_SUPABASE_URL: "https://wajqgyhugvcorgxgrdlv.supabase.co/path" },
  { STAGING_APP_ORIGIN: "https://other.vercel.app" },
  { STAGING_APP_ORIGIN: "http://littlehello-preview.vercel.app" },
  { STAGING_APP_ORIGIN: "https://littlehello-preview.vercel.app/path" },
  { STAGING_APP_ORIGIN: "https://user:pass@littlehello-preview.vercel.app" },
  { STAGING_ALLOWED_USER_IDS: "" },
  { STAGING_ALLOWED_USER_IDS: "invalid" },
  { STAGING_ALLOWED_PHONES: "" },
  { STAGING_ALLOWED_PHONES: "123" },
])("synthetic readers reject incomplete or wrong-target staging configuration: %j", (override) => {
  for (const read of [
    readPaymentConfig,
    readNotificationConfig,
    readWorkspaceMode,
    readFeedbackAdminMode,
  ])
    expect(() => read({ ...preview, ...override })).toThrow();
});
test("staging notification origin cannot redirect jobs away from approved application", () => {
  expect(() =>
    readNotificationConfig({ ...preview, NOTIFICATION_APP_ORIGIN: "https://other.vercel.app" }),
  ).toThrow();
});

test("staging never accepts Razorpay mode, even test keys", () => {
  expect(() =>
    readPaymentConfig({
      ...preview,
      PAYMENT_MODE: "razorpay",
      RAZORPAY_KEY_ID: "rzp_test_123",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "s".repeat(32),
    }),
  ).toThrow();
});
test("staging phone policy only authenticates precreated invited accounts", async () => {
  const { phoneOtpOptions, isStagingUserAllowed } = await import("@/lib/deployment");
  expect(phoneOtpOptions(preview, "+919000001001")).toEqual({ shouldCreateUser: false });
  expect(phoneOtpOptions(preview, "+919000001002")).toBeNull();
  expect(isStagingUserAllowed(preview, user)).toBe(true);
  expect(isStagingUserAllowed(preview, "fa100000-0000-4000-8000-000000000002")).toBe(false);
  expect(phoneOtpOptions({}, "+919000001002")).toEqual({ shouldCreateUser: true });
});
test("staging refuses local private mode instead of silently enabling hosted private features", () => {
  expect(() => readWorkspaceMode({ ...preview, COUNSELOR_WORKSPACE_MODE: "local" })).toThrow();
  expect(() => readFeedbackAdminMode({ ...preview, FEEDBACK_ADMIN_MODE: "local" })).toThrow();
});
test("preview requests must use the one approved origin, never an alias or forged port", async () => {
  const { isDeploymentRequestAllowed } = await import("@/lib/deployment");
  expect(isDeploymentRequestAllowed(preview, "https://littlehello-preview.vercel.app/login")).toBe(
    true,
  );
  expect(isDeploymentRequestAllowed(preview, "https://other.vercel.app/login")).toBe(false);
  expect(isDeploymentRequestAllowed(preview, "http://littlehello-preview.vercel.app/login")).toBe(
    false,
  );
  expect(
    isDeploymentRequestAllowed(preview, "https://littlehello-preview.vercel.app:444/login"),
  ).toBe(false);
  expect(isDeploymentRequestAllowed({}, "http://localhost:3000/login")).toBe(true);
});
test.each([
  { APP_ENV: undefined, VERCEL_ENV: "production" },
  { APP_ENV: "production", VERCEL_ENV: "production" },
  { APP_ENV: undefined, VERCEL_ENV: "preview" },
])(
  "partial staging configuration never falls back to unrestricted identity: %j",
  async (override) => {
    const { readDeployment, isStagingUserAllowed, phoneOtpOptions, isDeploymentRequestAllowed } =
      await import("@/lib/deployment");
    const env = { ...preview, ...override };
    expect(() => readDeployment(env)).toThrow();
    expect(() => isStagingUserAllowed(env, "fa100000-0000-4000-8000-000000000002")).toThrow();
    expect(() => phoneOtpOptions(env, "+919000001002")).toThrow();
    expect(() => isDeploymentRequestAllowed(env, "https://other.vercel.app")).toThrow();
  },
);
test("the dedicated staging target alone cannot be mistaken for production or local", async () => {
  const { readDeployment } = await import("@/lib/deployment");
  for (const url of [
    "https://wajqgyhugvcorgxgrdlv.supabase.co",
    "https://wajqgyhugvcorgxgrdlv.supabase.co/",
    "https://WAJQGYHUGVCORGXGRDLV.supabase.co",
  ])
    expect(() =>
      readDeployment({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: url }),
    ).toThrow();
  expect(() => readDeployment({ APP_ENV: "production", STAGING_ALLOWED_USER_IDS: user })).toThrow();
  expect(
    readDeployment({
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://different.supabase.co",
    }).kind,
  ).toBe("production");
});
