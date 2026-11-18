"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export type BookingActionState = { status: "idle" | "error" | "success"; message: string };

export async function submitBooking(
  _state: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireProfileRole("customer");
  const parsed = z
    .object({
      counselor: z.string().uuid(),
      start: z.iso.datetime({ offset: true }),
      reschedule: z.union([z.literal(""), z.string().uuid()]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "The selected time is invalid." };
  const supabase = await createSupabaseServerClient();
  const { error } = parsed.data.reschedule
    ? await supabase.rpc("reschedule_booking", {
        p_booking_id: parsed.data.reschedule,
        p_counselor_id: parsed.data.counselor,
        p_start_at: parsed.data.start,
      })
    : await supabase.rpc("create_booking_hold", {
        p_counselor_id: parsed.data.counselor,
        p_start_at: parsed.data.start,
      });
  if (error)
    return {
      status: "error",
      message: "This time is unavailable or the booking cannot be changed. Choose another time.",
    };
  revalidatePath(`/counselors/${parsed.data.counselor}`);
  revalidatePath("/bookings");
  redirect("/bookings");
}

export async function saveHoldSettings(
  _state: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireProfileRole("admin");
  const parsed = z.coerce.number().int().min(1).max(60).safeParse(formData.get("holdMinutes"));
  if (!parsed.success)
    return { status: "error", message: "Enter a hold duration from 1 to 60 minutes." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_booking_hold_minutes", { p_hold_minutes: parsed.data });
  if (error) return { status: "error", message: "Hold duration could not be saved." };
  revalidatePath("/admin/availability");
  return { status: "success", message: "Hold duration saved." };
}
