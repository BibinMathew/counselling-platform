import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export async function getMyBookings() {
  await requireProfileRole("customer");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_bookings");
  if (error) throw new Error("Bookings could not be loaded.");
  const now = Date.now();
  return data.map((booking) => ({
    ...booking,
    canReschedule:
      booking.status === "confirmed" &&
      booking.reschedule_count === 0 &&
      new Date(booking.start_at).getTime() - now >= 24 * 60 * 60 * 1000,
  }));
}
