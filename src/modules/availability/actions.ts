"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfile, requireProfileRole } from "@/modules/identity/server/access";

export type AvailabilityState = { status: "idle" | "success" | "error"; message: string };
const uuid = z.string().uuid();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.iso.date();

async function requireScheduler() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "counselor") redirect("/unauthorized");
}

function refreshAvailability(counselorId: string) {
  revalidatePath("/counselor/availability");
  revalidatePath(`/admin/counselors/${counselorId}/availability`);
  revalidatePath(`/counselors/${counselorId}`);
}

export async function saveRule(
  _state: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  await requireScheduler();
  const parsed = z
    .object({
      counselorId: uuid,
      id: z.union([z.literal(""), uuid]),
      weekday: z.coerce.number().int().min(0).max(6),
      start: time,
      end: time,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.start >= parsed.data.end)
    return { status: "error", message: "Enter a valid day and a start time before the end time." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_availability_rule", {
    p_counselor_id: parsed.data.counselorId,
    p_id: parsed.data.id || null,
    p_weekday: parsed.data.weekday,
    p_start_time: parsed.data.start,
    p_end_time: parsed.data.end,
  });
  if (error) return { status: "error", message: "Weekly hours could not be saved." };
  refreshAvailability(parsed.data.counselorId);
  return { status: "success", message: "Weekly hours saved." };
}

export async function saveException(
  _state: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  await requireScheduler();
  const parsed = z
    .object({
      counselorId: uuid,
      id: z.union([z.literal(""), uuid]),
      date,
      kind: z.enum(["opening", "blocked"]),
    })
    .safeParse(Object.fromEntries(formData));
  const allDay = formData.get("allDay") === "on";
  const start = time.safeParse(formData.get("start"));
  const end = time.safeParse(formData.get("end"));
  if (
    !parsed.success ||
    (allDay && parsed.data.kind !== "blocked") ||
    (!allDay && (!start.success || !end.success || start.data >= end.data))
  )
    return {
      status: "error",
      message: "Enter a valid date and time range. Only blocked dates can be all day.",
    };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_availability_exception", {
    p_counselor_id: parsed.data.counselorId,
    p_id: parsed.data.id || null,
    p_local_date: parsed.data.date,
    p_kind: parsed.data.kind,
    p_all_day: allDay,
    p_start_time: allDay ? null : start.data!,
    p_end_time: allDay ? null : end.data!,
  });
  if (error)
    return { status: "error", message: "The date-specific availability could not be saved." };
  refreshAvailability(parsed.data.counselorId);
  return { status: "success", message: "Date-specific availability saved." };
}

export async function deleteAvailability(
  _state: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  await requireScheduler();
  const parsed = z
    .object({ counselorId: uuid, id: uuid, kind: z.enum(["rule", "exception"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Invalid availability entry." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_availability", {
    p_counselor_id: parsed.data.counselorId,
    p_id: parsed.data.id,
    p_kind: parsed.data.kind,
  });
  if (error) return { status: "error", message: "The availability entry could not be deleted." };
  refreshAvailability(parsed.data.counselorId);
  return { status: "success", message: "Availability entry deleted." };
}

export async function saveSettings(
  _state: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  await requireProfileRole("admin");
  const parsed = z
    .object({
      session: z.coerce.number().int().min(15).max(180),
      buffer: z.coerce.number().int().min(0).max(120),
      notice: z.coerce.number().int().min(0).max(14400),
      days: z.coerce.number().int().min(1).max(90),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.notice > parsed.data.days * 1440)
    return { status: "error", message: "Check the scheduling settings and booking window." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_availability_settings", {
    p_session_minutes: parsed.data.session,
    p_buffer_minutes: parsed.data.buffer,
    p_min_notice_minutes: parsed.data.notice,
    p_max_advance_days: parsed.data.days,
  });
  if (error) return { status: "error", message: "Scheduling settings could not be saved." };
  revalidatePath("/counselors");
  revalidatePath("/counselors/[id]", "page");
  revalidatePath("/admin/availability");
  return { status: "success", message: "Scheduling settings saved." };
}
