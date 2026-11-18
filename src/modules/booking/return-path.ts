import { z } from "zod";

export function safeBookingReturn(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 600 || !value.startsWith("/book?")) return null;
  const parsed = new URL(value, "https://booking.invalid");
  if (parsed.origin !== "https://booking.invalid" || parsed.pathname !== "/book" || parsed.hash)
    return null;
  const keys = [...parsed.searchParams.keys()];
  if (keys.some((key) => !["counselor", "start", "reschedule"].includes(key))) return null;
  if (
    parsed.searchParams.getAll("counselor").length !== 1 ||
    parsed.searchParams.getAll("start").length !== 1 ||
    parsed.searchParams.getAll("reschedule").length > 1
  )
    return null;
  const counselor = z.string().uuid().safeParse(parsed.searchParams.get("counselor"));
  const start = z.iso.datetime({ offset: true }).safeParse(parsed.searchParams.get("start"));
  const reschedule = parsed.searchParams.get("reschedule");
  if (
    !counselor.success ||
    !start.success ||
    (reschedule !== null && !z.string().uuid().safeParse(reschedule).success)
  )
    return null;
  const query = new URLSearchParams({ counselor: counselor.data, start: start.data });
  if (reschedule) query.set("reschedule", reschedule);
  return `/book?${query}`;
}
