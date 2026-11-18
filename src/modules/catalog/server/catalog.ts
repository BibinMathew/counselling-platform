import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export async function getPublicCounselors() {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("public_counselors").select("*").order("display_name");
  if (result.error) throw new Error("Counselor directory unavailable.");
  return result.data;
}

export async function getPublicCounselor(id: string) {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("public_counselors").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Counselor profile unavailable.");
  return result.data;
}

export async function getAdminCounselors() {
  await requireProfileRole("admin");
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("counselors").select("*").order("display_name");
  if (result.error) throw new Error("Counselor management unavailable.");
  return result.data;
}
