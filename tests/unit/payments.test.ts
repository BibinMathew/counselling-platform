import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readPaymentConfig } from "@/modules/payments/config";
import { assertCapturedPayment, verifySignature } from "@/modules/payments/verification";

describe("payment trust boundary", () => {
  const env = {
    NODE_ENV: "development",
    PAYMENT_MODE: "simulator",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    PAYMENT_SIMULATOR_SECRET: "a-local-secret-with-at-least-32-characters",
  };
  it("refuses simulator access to hosted data and production runtimes", () => {
    expect(readPaymentConfig(env).mode).toBe("simulator");
    expect(() => readPaymentConfig({ ...env, NODE_ENV: "production" })).toThrow();
    expect(() =>
      readPaymentConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://hosted.supabase.co" }),
    ).toThrow();
  });
  it("rejects live keys and incomplete test credentials", () => {
    expect(() =>
      readPaymentConfig({ PAYMENT_MODE: "razorpay", RAZORPAY_KEY_ID: "rzp_live_123" }),
    ).toThrow();
    expect(() =>
      readPaymentConfig({ PAYMENT_MODE: "razorpay", RAZORPAY_KEY_ID: "rzp_test_123" }),
    ).toThrow();
    expect(readPaymentConfig({ PAYMENT_MODE: "disabled" }).mode).toBe("disabled");
  });
  it("authenticates exact bytes and rejects malformed or wrong-secret signatures", () => {
    const body = '{"event":"payment.captured"}';
    const signature = createHmac("sha256", "webhook-only").update(body).digest("hex");
    expect(verifySignature(body, signature, "webhook-only")).toBe(true);
    expect(verifySignature(body + " ", signature, "webhook-only")).toBe(false);
    expect(verifySignature(body, signature, "api-key-secret")).toBe(false);
    for (const invalid of ["", "zz".repeat(32), "aa", "a".repeat(65)])
      expect(verifySignature(body, invalid, "webhook-only")).toBe(false);
  });
  const order = {
    id: "order_1",
    receipt: "internal-1",
    amount: 69900,
    currency: "INR",
    status: "paid",
  };
  const payment = {
    id: "pay_1",
    order_id: "order_1",
    amount: 69900,
    currency: "INR",
    status: "captured",
  };
  it("requires a captured payment on its fully paid exact-price order", () => {
    expect(() =>
      assertCapturedPayment(order, payment, {
        id: "order_1",
        receipt: "internal-1",
        amount: 69900,
        currency: "INR",
      }),
    ).not.toThrow();
    for (const invalid of [
      { ...payment, amount: 1 },
      { ...payment, currency: "USD" },
      { ...payment, order_id: "order_other" },
      { ...payment, status: "authorized" },
    ]) {
      expect(() =>
        assertCapturedPayment(order, invalid, {
          id: "order_1",
          receipt: "internal-1",
          amount: 69900,
          currency: "INR",
        }),
      ).toThrow();
    }
    expect(() =>
      assertCapturedPayment({ ...order, status: "attempted" }, payment, {
        id: "order_1",
        receipt: "internal-1",
        amount: 69900,
        currency: "INR",
      }),
    ).toThrow();
    expect(() =>
      assertCapturedPayment(order, payment, {
        id: "order_1",
        receipt: "another-booking",
        amount: 69900,
        currency: "INR",
      }),
    ).toThrow();
  });
});
