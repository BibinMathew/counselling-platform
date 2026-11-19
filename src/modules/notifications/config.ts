import { requireSyntheticRuntime } from "@/lib/deployment";
export function readNotificationConfig(env: Record<string, string | undefined>): {
  mode: "disabled" | "simulator";
  appOrigin: string;
} {
  const mode = env.NOTIFICATION_MODE ?? "disabled";
  if (mode === "disabled") return { mode, appOrigin: "" };
  if (mode !== "simulator") throw new Error("Unsupported notification mode.");
  const deployment = requireSyntheticRuntime(env);
  const origin = env.NOTIFICATION_APP_ORIGIN ?? "http://127.0.0.1:3000";
  if (deployment.kind === "staging") {
    if (origin !== deployment.appOrigin) throw new Error("Notification origin must match staging.");
    return { mode, appOrigin: origin };
  }
  const url = new URL(origin);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Notifications require HTTP loopback origins.");
  return { mode, appOrigin: url.origin };
}
