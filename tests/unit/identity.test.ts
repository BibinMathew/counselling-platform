import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeIndianPhone } from "@/modules/identity/phone";
import { isProfileRoleAllowed } from "@/modules/identity/roles";
import { safeBookingReturn } from "@/modules/booking/return-path";
import { verifyPhoneOtp } from "@/modules/identity/actions";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
}));
vi.mock("@/modules/identity/server/access", () => ({
  requireAuthenticatedProfile: vi.fn(),
  requireProfile: vi.fn(),
  requireProfileRole: vi.fn(),
}));

describe("Indian phone normalization", () => {
  it("normalizes valid Indian numbers to E.164", () => {
    expect(normalizeIndianPhone("9000000001")).toBe("+919000000001");
    expect(normalizeIndianPhone("+91 90000 00001")).toBe("+919000000001");
  });

  it("rejects invalid numbers and unsupported countries", () => {
    expect(normalizeIndianPhone("12345")).toBeNull();
    expect(normalizeIndianPhone("+14155552671")).toBeNull();
  });
});

describe("role authorization", () => {
  it("allows only the active profile role", () => {
    expect(isProfileRoleAllowed("admin", ["admin"])).toBe(true);
    expect(isProfileRoleAllowed("customer", ["admin", "counselor"])).toBe(false);
    expect(isProfileRoleAllowed(null, ["customer"])).toBe(false);
  });
});

describe("booking return paths", () => {
  it("preserves a valid local booking selection", () => {
    const path =
      "/book?counselor=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&start=2031-01-01T04%3A30%3A00Z";
    expect(safeBookingReturn(path)).toBe(path);
  });

  it("rejects external, malformed, and ambiguous destinations", () => {
    expect(safeBookingReturn("https://example.test/book?counselor=x&start=x")).toBeNull();
    expect(safeBookingReturn("//example.test/book?counselor=x&start=x")).toBeNull();
    expect(safeBookingReturn("/book?counselor=bad&start=bad")).toBeNull();
    expect(
      safeBookingReturn(
        "/book?counselor=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&start=2031-01-01T04%3A30%3A00Z&next=https%3A%2F%2Fexample.test",
      ),
    ).toBeNull();
  });
});

describe("OTP booking continuation", () => {
  beforeEach(() => {
    mocks.verifyOtp.mockReset().mockResolvedValue({ error: null });
    mocks.redirect.mockReset().mockImplementation(() => {
      throw new Error("redirect");
    });
  });

  it("returns to a validated booking selection after verification", async () => {
    const form = new FormData();
    form.set("phone", "+919000000001");
    form.set("otp", "123456");
    const path =
      "/book?counselor=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&start=2031-01-01T04%3A30%3A00Z";
    form.set("next", path);
    await expect(verifyPhoneOtp(undefined, form)).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith(path);
  });

  it("does not redirect to an external URL", async () => {
    const form = new FormData();
    form.set("phone", "+919000000001");
    form.set("otp", "123456");
    form.set("next", "https://example.test/unsafe");
    await expect(verifyPhoneOtp(undefined, form)).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/profile");
  });
});
