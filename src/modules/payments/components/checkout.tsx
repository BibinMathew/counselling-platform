"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutDetails } from "../model";
import { formatPrice } from "../model";

type RazorpayResult = { razorpay_payment_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}
async function request<T>(operation: string, data: unknown): Promise<T> {
  const response = await fetch(`/api/payments/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Payment unavailable");
  return result;
}
async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Checkout could not load. Try again."));
    };
    document.head.appendChild(script);
  });
  if (!window.Razorpay) throw new Error("Checkout unavailable");
}
export function BookingPayment({
  bookingId,
  amount,
  orderId,
  canPay,
  enabled,
  reviewReason,
  paymentState,
}: {
  bookingId: string;
  amount: number;
  orderId?: string;
  canPay: boolean;
  enabled: boolean;
  reviewReason?: string | null;
  paymentState?: "pending" | "failed" | "confirmed" | "admin_review";
}) {
  const [checkout, setCheckout] = useState<CheckoutDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment unavailable");
    } finally {
      setBusy(false);
    }
  }
  const report = (outcome: string) => {
    setMessage(
      outcome === "confirmed"
        ? "Payment verified. Appointment confirmed."
        : outcome === "admin_review"
          ? "Payment received; this booking needs admin review. Do not pay again."
          : outcome === "failed"
            ? "Payment attempt failed. You can retry before the original hold expires."
            : outcome === "pending"
              ? "Payment is pending verification. Recheck payment before paying again."
              : outcome,
    );
    if (outcome === "confirmed" || outcome === "admin_review") setCheckout(null);
    router.refresh();
  };
  async function start() {
    const details = await request<CheckoutDetails>("checkout", { bookingId });
    setCheckout(details);
    if (details.provider === "razorpay") {
      await loadRazorpay();
      new window.Razorpay!({
        key: details.keyId,
        order_id: details.externalOrderId,
        amount: details.amount,
        currency: details.currency,
        name: "Counseling Platform",
        handler: (result) =>
          void perform(async () => {
            const verified = await request<{ outcome: string }>("verify", {
              id: details.id,
              paymentId: result.razorpay_payment_id,
              signature: result.razorpay_signature,
            });
            report(verified.outcome);
          }),
        modal: {
          ondismiss: () => {
            setCheckout(null);
            setMessage(
              "Checkout closed. Your original hold deadline still applies. Recheck payment if you attempted to pay.",
            );
            router.refresh();
          },
        },
      }).open();
    }
  }
  return (
    <div className="payment-controls">
      {paymentState && paymentState !== "confirmed" && (
        <p>
          Payment attempt:{" "}
          {paymentState === "pending"
            ? "pending verification"
            : paymentState === "admin_review"
              ? "admin review"
              : paymentState}
        </p>
      )}
      {reviewReason && (
        <p role="alert">
          Payment needs admin review ({reviewReason.replaceAll("_", " ")}). Do not pay again.
        </p>
      )}
      {!enabled && canPay && <p>Payments are not configured yet.</p>}
      {enabled && canPay && !reviewReason && !checkout && (
        <button disabled={busy} onClick={() => void perform(start)}>
          Pay {formatPrice(amount)}
        </button>
      )}
      {enabled && (orderId || checkout) && (
        <button
          disabled={busy}
          onClick={() =>
            void perform(async () =>
              report(
                (await request<{ outcome: string }>("refresh", { id: checkout?.id ?? orderId }))
                  .outcome,
              ),
            )
          }
        >
          Recheck payment
        </button>
      )}
      {checkout?.provider === "simulator" && (
        <section className="payment-simulator" aria-label="Payment simulator">
          <h3>Local payment simulator</h3>
          <p>No money is collected. Total: {formatPrice(checkout.amount)}</p>
          {(
            [
              { label: "Simulate captured payment", result: "captured", deliver: true },
              { label: "Simulate failed attempt", result: "failed", deliver: true },
              { label: "Simulate authorized payment", result: "authorized", deliver: true },
              { label: "Capture without delivery", result: "captured", deliver: false },
            ] as const
          ).map((option) => (
            <button
              key={option.label}
              disabled={busy}
              onClick={() =>
                void perform(async () =>
                  report(
                    (
                      await request<{ outcome: string }>("simulate", {
                        id: checkout.id,
                        result: option.result,
                        deliver: option.deliver,
                      })
                    ).outcome,
                  ),
                )
              }
            >
              {option.label}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => {
              setCheckout(null);
              setMessage("Checkout closed. The original hold deadline still applies.");
              router.refresh();
            }}
          >
            Close checkout
          </button>
        </section>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
