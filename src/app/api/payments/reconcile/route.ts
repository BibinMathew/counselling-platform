import { isDeploymentRequestAllowed } from "@/lib/deployment";
import { timingSafeEqual } from "node:crypto";
import { reconcilePayments } from "@/modules/payments/server";
export async function POST(request: Request) {
  try {
    if (!isDeploymentRequestAllowed(process.env, request.url))
      return Response.json({ error: "Invalid deployment origin" }, { status: 403 });
  } catch {
    return Response.json({ error: "Deployment unavailable" }, { status: 503 });
  }

  const secret = process.env.PAYMENT_RECONCILE_SECRET ?? "";
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    secret.length < 32 ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await reconcilePayments());
  } catch {
    return Response.json({ error: "Reconciliation unavailable" }, { status: 503 });
  }
}
