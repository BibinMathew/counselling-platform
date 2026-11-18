import { describe, expect, it } from "vitest";
import { normalizeIndianPhone } from "@/modules/identity/phone";
import { isProfileRoleAllowed } from "@/modules/identity/roles";

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
