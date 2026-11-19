import { test, expect } from "vitest";
import { navigationLinks, activeNavigation, isWorkspacePath } from "@/modules/identity/navigation";
test("role navigation respects Phase9 gate", () => {
  expect(navigationLinks("customer", false).map((l) => l.href)).toEqual([
    "/customer",
    "/bookings",
    "/profile",
  ]);
  expect(navigationLinks("counselor", true).map((l) => l.href)).toEqual([
    "/counselor",
    "/counselor/availability",
    "/profile",
  ]);
  expect(navigationLinks("admin", false).some((l) => l.href === "/admin/feedback")).toBe(false);
  expect(navigationLinks("admin", true).some((l) => l.href === "/admin/exceptions")).toBe(true);
});
test("active link uses segment-safe and most-specific matching", () => {
  const links = navigationLinks("admin", true);
  expect(activeNavigation("/admin", links)).toBe("/admin");
  expect(activeNavigation("/admin/counselors/one/availability", links)).toBe("/admin/counselors");
  expect(activeNavigation("/administrator", links)).toBeNull();
  expect(activeNavigation("/counselor/appointments/one", navigationLinks("counselor", true))).toBe(
    "/counselor",
  );
  expect(activeNavigation("/counselor/availability", navigationLinks("counselor", true))).toBe(
    "/counselor/availability",
  );
});
test("public pages never acquire a workspace sidebar", () => {
  for (const role of ["admin", "counselor", "customer"] as const) {
    for (const path of ["/", "/counselors", "/login", "/complete-profile"])
      expect(isWorkspacePath(path, role)).toBe(false);
    expect(isWorkspacePath("/profile", role)).toBe(true);
  }
  expect(isWorkspacePath("/admin", "customer")).toBe(false);
  expect(isWorkspacePath("/bookings/one/feedback", "customer")).toBe(true);
  expect(isWorkspacePath("/book", "customer")).toBe(true);
});

test("global auth links retain only validated selected booking return paths", async () => {
  const { authenticationHref } = await import("@/modules/identity/navigation");
  const next =
    "/book?counselor=f9000000-0000-4000-8000-000000000001&start=2026-11-22T10%3A00%3A00Z";
  expect(
    new URL(authenticationHref("/login", next), "http://local.test").searchParams.get("next"),
  ).toBe(next);
  expect(authenticationHref("/complete-profile", "https://evil.test")).toBe("/complete-profile");
});
