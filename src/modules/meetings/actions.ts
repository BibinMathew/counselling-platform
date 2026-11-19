"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfileRole } from "@/modules/identity/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canonicalMeetingUrl } from "./model";
import { createManualMeetingProvider } from "./provider";
export async function saveMeeting(
  _state: { message: string },
  form: FormData,
): Promise<{ message: string }> {
  await requireProfileRole("admin");
  let url: string;
  const id = z.string().uuid().safeParse(form.get("bookingId"));
  try {
    url = canonicalMeetingUrl(String(form.get("meetingUrl") ?? ""));
  } catch {
    return {
      message: "Enter a link like https://meet.google.com/abc-defg-hij with no extra parameters.",
    };
  }
  if (!id.success) return { message: "Select a valid appointment." };
  const db = await createSupabaseServerClient();
  const provider = createManualMeetingProvider(async (assignment) => {
    const { error } = await db.rpc("set_booking_meeting", {
      p_booking_id: assignment.bookingId,
      p_url: assignment.url,
    });
    if (error) throw new Error("Meeting assignment unavailable");
  });
  try {
    await provider.assign({ bookingId: id.data, url });
  } catch {
    return {
      message: "Link could not be saved. Use a unique link for a future confirmed appointment.",
    };
  }
  for (const path of ["/admin/appointments", "/admin/notifications", "/bookings", "/counselor"])
    revalidatePath(path);
  return { message: "Meeting link saved." };
}
