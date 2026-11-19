import { expect, test, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const { db, signIn, verify, signOut, profileRead } = vi.hoisted(() => {
  const signIn = vi.fn(async () => ({ error: null }));
  const verify = vi.fn(async () => ({ error: null }));
  const signOut = vi.fn(async () => ({ error: null }));
  const claims = vi.fn(async () => ({
    data: { claims: { sub: "fa100000-0000-4000-8000-000000000002" } },
    error: null,
  }));
  const profileRead = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { id: "fa100000-0000-4000-8000-000000000002" },
          error: null,
        }),
      }),
    }),
  }));
  return {
    db: {
      auth: { signInWithOtp: signIn, verifyOtp: verify, getClaims: claims, signOut },
      from: profileRead,
    },
    signIn,
    verify,
    signOut,
    profileRead,
  };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (value: string) => {
    throw Error("redirect:" + value);
  },
}));
import { requestPhoneOtp, verifyPhoneOtp } from "@/modules/identity/actions";
import { getCurrentProfile } from "@/modules/identity/server/access";
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    APP_ENV: "staging",
    VERCEL_ENV: "preview",
    VERCEL_URL: "littlehello-preview.vercel.app",
    STAGING_APP_ORIGIN: "https://littlehello-preview.vercel.app",
    NEXT_PUBLIC_SUPABASE_URL: "https://wajqgyhugvcorgxgrdlv.supabase.co",
    STAGING_ALLOWED_USER_IDS: "fa100000-0000-4000-8000-000000000001",
    STAGING_ALLOWED_PHONES: "+919000001001",
  }))
    vi.stubEnv(key, value);
});
function form(phone: string) {
  const f = new FormData();
  f.set("phone", phone);
  f.set("adultConfirmed", "on");
  f.set("otp", "123456");
  return f;
}
test("unknown staging phone does not call Auth request or verify", async () => {
  const result = await requestPhoneOtp(undefined, form("+919000001002"));
  expect(result.status).toBe("error");
  expect(signIn).not.toHaveBeenCalled();
  const checked = await verifyPhoneOtp(undefined, form("+919000001002"));
  expect(checked.status).toBe("error");
  expect(verify).not.toHaveBeenCalled();
});
test("invited staging request explicitly prevents account creation", async () => {
  expect((await requestPhoneOtp(undefined, form("+919000001001"))).status).toBe("otp_sent");
  expect(signIn).toHaveBeenCalledWith(
    expect.objectContaining({
      phone: "+919000001001",
      options: expect.objectContaining({ shouldCreateUser: false }),
    }),
  );
});
test("a valid but uninvited session cannot read or mutate its profile", async () => {
  expect(await getCurrentProfile()).toBeNull();
  expect(profileRead).not.toHaveBeenCalled();
});

test("verification revokes an uninvited session before any optional name write", async () => {
  const input = form("+919000001001");
  input.set("preferredName", "Fictional tester");
  expect((await verifyPhoneOtp(undefined, input)).status).toBe("error");
  expect(signOut).toHaveBeenCalledOnce();
  expect(profileRead).not.toHaveBeenCalled();
});
