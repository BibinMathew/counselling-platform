import "server-only";
import { z } from "zod";
import { requireProfileRole } from "@/modules/identity/server/access";
import { localOperation } from "@/lib/supabase/local-operation";
import {
  bookingRowSchema,
  caseRowSchema,
  caseEventSchema,
  listQuery,
  overviewSchema,
  pageSchema,
  type QueryInput,
} from "./model";
export async function getOverview() {
  const actor = await requireProfileRole("admin");
  return localOperation("phase9_overview", { p_actor: actor.id }, overviewSchema);
}
export async function getAdminBookings(input: QueryInput) {
  const actor = await requireProfileRole("admin");
  const query = listQuery(input, ["all", "upcoming", "past", "holds", "expired"]);
  return {
    ...query,
    ...(await localOperation(
      "phase9_bookings",
      {
        p_actor: actor.id,
        p_view: query.view,
        p_counselor: query.counselor ?? null,
        p_booking: query.booking ?? null,
        p_page: query.page,
      },
      pageSchema(bookingRowSchema),
    )),
  };
}
export async function getCases(input: QueryInput) {
  const actor = await requireProfileRole("admin");
  const query = listQuery(input, ["all", "open", "in_progress", "closed"]);
  return {
    ...query,
    ...(await localOperation(
      "phase9_cases",
      { p_actor: actor.id, p_state: query.view, p_page: query.page },
      pageSchema(caseRowSchema),
    )),
  };
}
export async function getCaseDetail(id: string, input: QueryInput) {
  const actor = await requireProfileRole("admin");
  const query = listQuery(input, ["all"]);
  const data = await localOperation(
    "phase9_case_detail",
    { p_actor: actor.id, p_case: z.string().uuid().parse(id), p_page: query.page },
    pageSchema(caseEventSchema)
      .extend({
        case: caseRowSchema,
        source: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .nullable(),
      })
      .nullable(),
  );
  return data ? { ...query, ...data } : null;
}
