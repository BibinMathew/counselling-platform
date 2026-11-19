import { isDeploymentRequestAllowed } from "@/lib/deployment";
import { handleNotificationRequest } from "@/modules/notifications/http";
import { dispatchNotifications } from "@/modules/notifications/server";
export async function POST(request: Request) {
  try {
    if (!isDeploymentRequestAllowed(process.env, request.url))
      return Response.json({ error: "Invalid deployment origin" }, { status: 403 });
  } catch {
    return Response.json({ error: "Deployment unavailable" }, { status: 503 });
  }

  return handleNotificationRequest(request, process.env, dispatchNotifications);
}
