import { isDeploymentRequestAllowed } from "@/lib/deployment";
import { z } from "zod";
import { getCurrentProfile } from "@/modules/identity/server/access";
import {
  getOwnedPayment,
  recheckPayment,
  simulatePayment,
  startCheckout,
  verifyCheckout,
} from "@/modules/payments/server";
import { hasSameOrigin, readLimitedBody } from "@/modules/payments/http";
export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  try {
    if (!isDeploymentRequestAllowed(process.env, request.url))
      return Response.json({ error: "Invalid deployment origin" }, { status: 403 });
  } catch {
    return Response.json({ error: "Deployment unavailable" }, { status: 503 });
  }

  if (!hasSameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "customer" || !profile.email)
    return Response.json({ error: "Customer sign-in required" }, { status: 401 });
  const { operation } = await context.params;
  if (!["checkout", "verify", "refresh", "simulate"].includes(operation))
    return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const input = JSON.parse(await readLimitedBody(request, 4096));
    if (operation === "checkout") {
      const { bookingId } = z.object({ bookingId: z.string().uuid() }).parse(input);
      return Response.json(await startCheckout(bookingId, profile.id));
    }
    const { id } = z.object({ id: z.string().uuid() }).parse(input);
    if (operation === "verify") {
      const data = z
        .object({ paymentId: z.string().min(1).max(100), signature: z.string().length(64) })
        .parse(input);
      return Response.json({
        outcome: await verifyCheckout(id, profile.id, data.paymentId, data.signature),
      });
    }
    if (operation === "refresh")
      return Response.json({
        outcome: await recheckPayment(await getOwnedPayment(id, profile.id)),
      });
    const data = z
      .object({ result: z.enum(["captured", "failed", "authorized"]), deliver: z.boolean() })
      .parse(input);
    return Response.json({
      outcome: await simulatePayment(id, profile.id, data.result, data.deliver),
    });
  } catch (error) {
    console.error("Payment operation failed", {
      operation,
      category: error instanceof Error ? error.name : "unknown",
      validationPaths:
        error instanceof z.ZodError ? error.issues.map((issue) => issue.path.join(".")) : undefined,
    });
    return Response.json(
      {
        error:
          "Payment could not be completed. Recheck payment status or refresh your bookings; your original hold deadline still applies.",
      },
      { status: 400 },
    );
  }
}
