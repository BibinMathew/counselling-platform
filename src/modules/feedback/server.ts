import "server-only";
import { z } from "zod";
import { requireProfileRole } from "@/modules/identity/server/access";
import { localOperation } from "@/lib/supabase/local-operation";
import { feedbackPageSchema, feedbackRowSchema } from "./model";
import { listQuery, pageSchema, type QueryInput } from "@/modules/admin-operations/model";
export async function getFeedbackPage(booking: string) {
  const actor = await requireProfileRole("customer");
  return localOperation(
    "phase9_feedback_page",
    { p_actor: actor.id, p_booking: z.string().uuid().parse(booking) },
    feedbackPageSchema.nullable(),
  );
}
export async function getFeedbackSummaries(bookings: string[]) {
  const actor = await requireProfileRole("customer");
  return localOperation(
    "phase9_feedback_summaries",
    { p_actor: actor.id, p_bookings: bookings },
    z.array(z.object({ booking_id: z.string().uuid(), submitted: z.boolean() })).max(20),
  );
}
export async function getAdminFeedback(input: QueryInput) {
  const actor = await requireProfileRole("admin");
  const query = listQuery(input, ["all", "unreviewed", "reviewed"]);
  const data = await localOperation(
    "phase9_feedback_list",
    {
      p_actor: actor.id,
      p_state: query.view,
      p_counselor: query.counselor ?? null,
      p_page: query.page,
    },
    pageSchema(feedbackRowSchema),
  );
  return { ...query, ...data };
}
