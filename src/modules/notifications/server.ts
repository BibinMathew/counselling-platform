import "server-only";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfileRole } from "@/modules/identity/server/access";
import { readNotificationConfig } from "./config";
import { dispatchBatch } from "./provider";
import { notificationPage, notificationSchema, receiptSchema } from "./model";
export async function dispatchNotifications() {
  const config = readNotificationConfig(process.env);
  if (config.mode !== "simulator") return { checked: 0, delivered: 0, failed: 0 };
  const db = createSupabaseServiceClient();
  const claimed = await db.rpc("claim_notification_jobs", { p_limit: 20 });
  if (claimed.error) throw new Error("Notification claims unavailable");
  const jobs = z
    .array(z.object({ id: z.string().uuid(), lease_token: z.string().uuid() }))
    .parse(claimed.data);
  return dispatchBatch(
    jobs.map((j) => ({ id: j.id, leaseToken: j.lease_token })),
    {
      async dispatch(job) {
        const { data, error } = await db.rpc("dispatch_simulated_notification", {
          p_job_id: job.id,
          p_lease_token: job.leaseToken,
          p_app_origin: config.appOrigin,
        });
        if (error) throw new Error("Notification attempt unavailable");
        return z.string().parse(data);
      },
    },
  );
}
export async function getAdminNotifications(input: { page?: string; status?: string } = {}) {
  await requireProfileRole("admin");
  const config = readNotificationConfig(process.env);
  if (config.mode !== "simulator")
    return {
      mode: config.mode,
      jobs: [],
      receipts: [],
      page: 0,
      failedOnly: false,
      hasNext: false,
    };
  const db = await createSupabaseServerClient();
  const paging = notificationPage(input);
  let query = db
    .from("notification_jobs")
    .select("id,booking_id,channel,template,status,due_at,attempts,error_code", { count: "exact" });
  if (paging.failedOnly) query = query.eq("status", "failed");
  const jobs = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(paging.from, paging.to);
  if (jobs.error) throw new Error("Notification summaries unavailable");
  const parsed = z.array(notificationSchema).parse(jobs.data);
  // Raw receipt reads are unavailable to browser roles, including admin sessions.
  const receipts = parsed.length
    ? await createSupabaseServiceClient()
        .from("notification_simulator_receipts")
        .select("job_id,channel,destination,subject,body,created_at")
        .in(
          "job_id",
          parsed.map((j) => j.id),
        )
    : { data: [], error: null };
  if (receipts.error) throw new Error("Synthetic previews unavailable");
  return {
    mode: config.mode,
    jobs: parsed,
    receipts: z.array(receiptSchema).parse(receipts.data),
    page: paging.page,
    failedOnly: paging.failedOnly,
    hasNext: (jobs.count ?? 0) > paging.to + 1,
  };
}
