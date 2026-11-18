import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProfileRoleAllowed, type ProfileRole } from "@/modules/identity/roles";

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, preferred_name, phone, email, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return profile;
}

export async function requireAuthenticatedProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireProfile() {
  const profile = await requireAuthenticatedProfile();

  if (!profile.email) {
    redirect("/complete-profile");
  }

  return profile;
}

export async function requireProfileRole(requiredRole: ProfileRole) {
  const profile = await requireProfile();

  if (!isProfileRoleAllowed(profile.role, [requiredRole])) {
    redirect("/unauthorized");
  }

  return profile;
}
