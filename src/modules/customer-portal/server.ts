import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfileRole } from "@/modules/identity/server/access";
import { parsePortalQuery, portalPageSchema, type PortalQueryInput } from "./model";
export async function getCustomerPortal(input: PortalQueryInput) {
  await requireProfileRole("customer");
  const query = parsePortalQuery(input);
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_customer_portal", {
    p_view: query.view,
    p_page: query.page,
    ...(query.booking ? { p_booking_id: query.booking } : {}),
  });
  if (error) throw new Error("Appointments could not be loaded.");
  return { ...query, ...portalPageSchema.parse(data) };
}
