import { connection } from "next/server";
import Link from "next/link";
import { getCurrentProfile } from "../server/access";
import { readFeedbackAdminMode } from "@/lib/local-features";
import { AppNavigation } from "./app-navigation";
export async function SessionNavigation() {
  await connection();
  const configured =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const profile = configured ? await getCurrentProfile() : null;
  return (
    <AppNavigation
      role={profile?.role ?? null}
      complete={Boolean(profile?.email)}
      phase9Enabled={profile?.role === "admin" && readFeedbackAdminMode(process.env) === "local"}
    />
  );
}
export function NavigationFallback() {
  return (
    <header className="site-header">
      <Link href="/" className="site-brand">
        littlehello
      </Link>
      <span className="muted">Loading account…</span>
    </header>
  );
}
