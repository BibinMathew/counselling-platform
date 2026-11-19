import { z } from "zod";
export type QueryInput = Record<string, string | string[] | undefined>;
export function listQuery(input: QueryInput, views: readonly string[]) {
  const view = z
    .string()
    .refine((v) => views.includes(v))
    .parse(input.view ?? "all");
  const raw = z
    .string()
    .regex(/^(0|[1-9][0-9]{0,5})$/)
    .parse(input.page ?? "0");
  const counselor =
    input.counselor === undefined || input.counselor === ""
      ? undefined
      : z.string().uuid().parse(input.counselor);
  const booking =
    input.booking === undefined || input.booking === ""
      ? undefined
      : z.string().uuid().parse(input.booking);
  return { view, page: Number(raw), counselor, booking };
}
export const remarkSchema = z
  .string()
  .trim()
  .refine((v) => Array.from(v).length <= 1000, "Use at most 1,000 characters.");
export const caseOpenInput = z.object({
  sourceType: z.enum(["booking", "payment_order", "payment_event", "notification_job"]),
  sourceId: z.string().uuid(),
  remark: remarkSchema,
  acknowledged: z.literal(true),
});
export const caseUpdateInput = z
  .object({
    caseId: z.string().uuid(),
    expectedVersion: z.number().int().min(1).max(1000000000),
    requestId: z.string().uuid(),
    action: z.enum(["start", "reset", "close", "reopen"]),
    remark: remarkSchema,
    acknowledged: z.literal(true),
  })
  .refine(
    (v) => !["close", "reopen"].includes(v.action) || v.remark.length > 0,
    "Add an operational remark when closing or reopening.",
  );
export const bookingRowSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  counselor_id: z.string().uuid(),
  counselor_name: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  status: z.enum(["held", "confirmed", "expired"]),
  reschedule_count: z.number().int(),
});
export const caseRowSchema = z.object({
  id: z.string().uuid(),
  source_type: z.string(),
  source_id: z.string().uuid(),
  booking_id: z.string().uuid().nullable(),
  status: z.enum(["open", "in_progress", "closed"]),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const caseEventSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string().uuid(),
  action: z.string(),
  remark: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string(),
});
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ as_of: z.string(), items: z.array(item).max(20), has_more: z.boolean() });
export const overviewSchema = z.object({
  as_of: z.string(),
  upcoming: z.number().int(),
  today: z.number().int(),
  missing_meet: z.number().int(),
  payment_review: z.number().int(),
  unmatched: z.number().int(),
  failed_notifications: z.number().int(),
  unreviewed: z.number().int(),
  active_cases: z.number().int(),
});
