"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfileRole } from "@/modules/identity/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchNotifications } from "./server";
import { readNotificationConfig } from "./config";
export async function notificationAction(
  _state: { message: string },
  form: FormData,
): Promise<{ message: string }> {
  await requireProfileRole("admin");
  try {
    if (readNotificationConfig(process.env).mode !== "simulator")
      return { message: "Notification delivery is paused." };
    const operation = form.get("operation");
    if (operation === "run") {
      const result = await dispatchNotifications();
      revalidatePath("/admin/notifications");
      return {
        message: `Checked ${result.checked}; simulated delivery ${result.delivered}; retry or failure ${result.failed}.`,
      };
    }
    if (operation !== "retry" && operation !== "fail")
      return { message: "Select a valid operation." };
    const id = z.string().uuid().parse(form.get("jobId"));
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc(
      operation === "retry" ? "retry_notification" : "fail_next_notification_attempt",
      { p_job_id: id },
    );
    if (error) return { message: "This job is no longer eligible for that operation." };
    revalidatePath("/admin/notifications");
    return {
      message:
        operation === "retry" ? "Retry queued." : "Next attempt will simulate a transient failure.",
    };
  } catch {
    return { message: "Notification operation unavailable. Check local configuration." };
  }
}
