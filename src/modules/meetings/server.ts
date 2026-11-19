import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfile, requireProfileRole } from "@/modules/identity/server/access";
import { appointmentSchema, meetingSchema } from "./model";
export async function getAccessibleMeetings() {
  await requireProfile();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_accessible_booking_meetings");
  if (error) throw new Error("Meeting information unavailable");
  return z.array(meetingSchema).parse(data);
}
export async function getAdminAppointments() {
  await requireProfileRole("admin");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_admin_confirmed_bookings");
  if (error) throw new Error("Appointments unavailable");
  return z.array(appointmentSchema).parse(data);
}
export async function getAssignedAppointments() {
  await requireProfileRole("counselor");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_assigned_confirmed_bookings");
  if (error) throw new Error("Appointments unavailable");
  return z.array(appointmentSchema).parse(data);
}
export function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
