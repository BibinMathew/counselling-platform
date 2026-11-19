import "server-only";
import { readPrivateFeatureMode } from "@/lib/deployment";
export function readFeedbackAdminMode(env: Record<string, string | undefined>) {
  return readPrivateFeatureMode(env, "FEEDBACK_ADMIN_MODE");
}
export function requireFeedbackAdmin() {
  if (readFeedbackAdminMode(process.env) === "disabled")
    throw new Error("Synthetic feedback and administration are disabled.");
}
