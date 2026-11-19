import { handleNotificationRequest } from "@/modules/notifications/http";
import { dispatchNotifications } from "@/modules/notifications/server";
export async function POST(request: Request) {
  return handleNotificationRequest(request, process.env, dispatchNotifications);
}
