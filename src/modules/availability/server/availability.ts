import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfile } from "@/modules/identity/server/access";

export async function getAvailabilityManagement(counselorId?: string) {
  const actor = await requireProfile();
  if (actor.role !== "admin" && actor.role !== "counselor") return null;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("counselors").select("id, display_name, profile_id");
  query = counselorId ? query.eq("id", counselorId) : query.eq("profile_id", actor.id);
  const { data: counselor, error } = await query.maybeSingle();
  if (error) throw new Error("Availability could not be loaded.");
  if (!counselor || (actor.role !== "admin" && counselor.profile_id !== actor.id)) return null;
  const [rules, exceptions, settings] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .eq("counselor_id", counselor.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("availability_exceptions")
      .select("*")
      .eq("counselor_id", counselor.id)
      .order("local_date")
      .order("start_time"),
    supabase.from("availability_settings").select("*").single(),
  ]);
  if (rules.error || exceptions.error || settings.error)
    throw new Error("Availability could not be loaded.");
  return {
    counselor,
    rules: rules.data,
    exceptions: exceptions.data,
    settings: settings.data,
    isAdmin: actor.role === "admin",
  };
}

export async function getPublicSessionSettings() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("public_session_settings").select("*").single();
  if (error || !data) throw new Error("Session settings could not be loaded.");
  return data;
}

export async function getPublicAvailability(counselorId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_availability", {
    p_counselor_id: counselorId,
  });
  if (error) throw new Error("Available times could not be loaded.");
  return data;
}
