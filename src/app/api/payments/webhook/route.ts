import { processPaymentWebhook } from "@/modules/payments/server";
import { readLimitedBody } from "@/modules/payments/http";
export async function POST(request: Request) {
  let body: string;
  try {
    body = await readLimitedBody(request);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 413 });
  }
  try {
    const outcome = await processPaymentWebhook(
      body,
      request.headers.get("x-razorpay-signature") ?? "",
      request.headers.get("x-razorpay-event-id") ?? "",
    );
    return Response.json({ received: true, outcome });
  } catch (error) {
    const invalid =
      error instanceof SyntaxError ||
      (error instanceof Error && /Invalid webhook|signature|Zod/.test(error.message));
    return Response.json(
      { error: invalid ? "Invalid webhook" : "Payment processing temporarily unavailable" },
      { status: invalid ? 400 : 503 },
    );
  }
}
