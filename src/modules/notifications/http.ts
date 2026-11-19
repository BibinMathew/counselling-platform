import { timingSafeEqual } from "node:crypto";
import { readNotificationConfig } from "./config";
export async function handleNotificationRequest(
  request: Request,
  env: Record<string, string | undefined>,
  run: () => Promise<{ checked: number; delivered: number; failed: number }>,
) {
  const secret = env.NOTIFICATION_WORKER_SECRET ?? "";
  const expected = `Bearer ${secret}`,
    provided = request.headers.get("authorization") ?? "";
  if (
    secret.length < 32 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (readNotificationConfig(env).mode === "disabled")
      return Response.json({ paused: true, checked: 0, delivered: 0, failed: 0 });
    return Response.json(await run());
  } catch {
    return Response.json({ error: "Notification processing unavailable" }, { status: 503 });
  }
}
