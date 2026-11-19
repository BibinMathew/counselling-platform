import { readFeedbackAdminMode } from "@/lib/local-features";
import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { getCurrentProfile } from "@/modules/identity/server/access";
import type { ProfileRole } from "@/modules/identity/roles";

const roleLinks: Record<ProfileRole, { href: string; label: string }[]> = {
  customer: [
    { href: "/customer", label: "Customer area" },
    { href: "/bookings", label: "Your bookings and appointment history" },
  ],
  counselor: [
    { href: "/counselor", label: "Counselor area and appointments" },
    { href: "/counselor/availability", label: "Manage availability" },
  ],
  admin: [
    { href: "/admin", label: "Admin area and account roles" },
    { href: "/admin/counselors", label: "Manage counselors" },
    { href: "/admin/availability", label: "Scheduling settings" },
    { href: "/admin/appointments", label: "Appointments and meeting links" },
    { href: "/admin/notifications", label: "Notifications" },
    { href: "/admin/payments", label: "Payments and pricing" },
  ],
};

export async function HomeAccount() {
  await connection();
  // Keep public rendering usable when local authentication is not configured.
  const configured =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const profile = configured ? await getCurrentProfile() : null;
  if (!profile) return null;
  const links = profile.email
    ? [...roleLinks[profile.role], { href: "/profile", label: "Your profile" }]
    : [{ href: "/complete-profile", label: "Complete profile" }];
  if (profile.email && profile.role === "admin" && readFeedbackAdminMode(process.env) === "local")
    links.splice(
      links.length - 1,
      0,
      { href: "/admin/bookings", label: "Booking oversight" },
      { href: "/admin/feedback", label: "Private feedback" },
      { href: "/admin/exceptions", label: "Operational exceptions" },
    );
  return (
    <>
      <nav aria-label="Your account" className="home-account">
        <h2>Your account</h2>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
