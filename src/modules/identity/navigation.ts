import { safeBookingReturn } from "@/modules/booking/return-path";
import type { ProfileRole } from "./roles";
export type NavLink = { href: string; label: string; group?: string; exact?: boolean };
export function navigationLinks(role: ProfileRole, phase9Enabled: boolean): NavLink[] {
  if (role === "customer")
    return [
      { href: "/customer", label: "Overview", exact: true },
      { href: "/bookings", label: "Bookings" },
      { href: "/profile", label: "Profile" },
    ];
  if (role === "counselor")
    return [
      { href: "/counselor", label: "Sessions" },
      { href: "/counselor/availability", label: "Availability" },
      { href: "/profile", label: "Profile" },
    ];
  return [
    { href: "/admin", label: "Overview", exact: true },
    ...(phase9Enabled ? [{ href: "/admin/bookings", label: "Bookings" }] : []),
    { href: "/admin/counselors", label: "Counselors" },
    { href: "/admin/availability", label: "Scheduling" },
    { href: "/admin/appointments", label: "Meeting links", group: "Operations" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/notifications", label: "Notifications" },
    ...(phase9Enabled
      ? [
          { href: "/admin/feedback", label: "Private feedback" },
          { href: "/admin/exceptions", label: "Exceptions" },
        ]
      : []),
    { href: "/profile", label: "Profile", group: "Account" },
  ];
}
const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
export function activeNavigation(path: string, links: NavLink[]): string | null {
  return (
    links
      .filter((l) => (l.exact ? path === l.href : matches(path, l.href)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
  );
}
export function isWorkspacePath(path: string, role: ProfileRole) {
  return (
    path === "/profile" ||
    (role === "admin"
      ? matches(path, "/admin")
      : role === "counselor"
        ? matches(path, "/counselor")
        : path === "/customer" || path === "/book" || matches(path, "/bookings"))
  );
}

export function authenticationHref(destination: "/login" | "/complete-profile", selected: unknown) {
  const next = safeBookingReturn(selected);
  return next ? `${destination}?${new URLSearchParams({ next })}` : destination;
}
