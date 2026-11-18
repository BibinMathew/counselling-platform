export type PaymentMode = "disabled" | "simulator" | "razorpay";
export type PaymentConfig = {
  mode: PaymentMode;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export function readPaymentConfig(env: Record<string, string | undefined>): PaymentConfig {
  const mode = env.PAYMENT_MODE ?? "disabled";
  if (!["disabled", "simulator", "razorpay"].includes(mode))
    throw new Error("Invalid payment mode");
  if (mode === "disabled") return { mode, keyId: "", keySecret: "", webhookSecret: "" };
  if (mode === "simulator") {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test")
      throw new Error("Simulator requires a local development runtime");
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      throw new Error("Simulator requires local Supabase");
    const secret = env.PAYMENT_SIMULATOR_SECRET ?? "";
    if (secret.length < 32)
      throw new Error("Configure a simulator secret with at least 32 characters");
    return { mode, keyId: "simulator", keySecret: secret, webhookSecret: secret };
  }
  if (
    !/^rzp_test_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID ?? "") ||
    !env.RAZORPAY_KEY_SECRET ||
    (env.RAZORPAY_WEBHOOK_SECRET?.length ?? 0) < 16
  )
    throw new Error(
      "Configure Razorpay Test Mode keys and webhook secret; live keys are unsupported",
    );
  return {
    mode: "razorpay",
    keyId: env.RAZORPAY_KEY_ID!,
    keySecret: env.RAZORPAY_KEY_SECRET!,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET!,
  };
}
