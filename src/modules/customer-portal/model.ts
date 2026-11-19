import { z } from "zod";
export const portalViews = ["all", "upcoming", "past", "holds"] as const;
export type PortalView = (typeof portalViews)[number];
export type PortalQueryInput = {
  view?: string | string[];
  page?: string | string[];
  booking?: string | string[];
};
export function parsePortalQuery(input: PortalQueryInput) {
  const view =
    typeof input.view === "string" && (portalViews as readonly string[]).includes(input.view)
      ? (input.view as PortalView)
      : "all";
  const page =
    typeof input.page === "string" && /^(0|[1-9][0-9]{0,5})$/.test(input.page)
      ? Number(input.page)
      : 0;
  const booking = z.string().uuid().safeParse(input.booking);
  return booking.success ? { view: "all" as const, page, booking: booking.data } : { view, page };
}
export const portalBookingSchema = z.object({
  id: z.string().uuid(),
  counselor_id: z.string().uuid(),
  counselor_name: z.string(),
  start_at: z.iso.datetime({ offset: true }),
  end_at: z.iso.datetime({ offset: true }),
  status: z.enum(["held", "expired", "confirmed"]),
  hold_expires_at: z.iso.datetime({ offset: true }),
  reschedule_count: z.number().int(),
  can_reschedule: z.boolean(),
  is_past: z.boolean(),
  in_progress: z.boolean(),
  counselor_bookable: z.boolean(),
  meeting_url: z.string().nullable(),
  order_id: z.string().uuid().nullable(),
  amount_paise: z.number().int().positive().nullable(),
  payment_state: z.enum(["pending", "failed", "confirmed", "admin_review"]).nullable(),
  review_reason: z.string().nullable(),
});
export const portalPageSchema = z.object({
  page: z.number().int().nonnegative().default(0),
  as_of: z.iso.datetime({ offset: true }),
  items: z.array(portalBookingSchema).max(20),
  has_more: z.boolean(),
});
export type PortalBooking = z.infer<typeof portalBookingSchema>;
export function bookAgainHref(row: Pick<PortalBooking, "counselor_id" | "counselor_bookable">) {
  return row.counselor_bookable ? `/counselors/${row.counselor_id}` : "/counselors";
}
