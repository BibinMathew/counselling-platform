import "server-only";
export function readFeedbackAdminMode(
  env: Record<string, string | undefined>,
): "disabled" | "local" {
  const mode = env.FEEDBACK_ADMIN_MODE ?? "disabled";
  if (mode === "disabled") return mode;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (
      mode !== "local" ||
      !["development", "test"].includes(env.NODE_ENV ?? "") ||
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw 0;
    return "local";
  } catch {
    throw new Error("Feedback and administration require local development configuration.");
  }
}
export function requireFeedbackAdmin() {
  if (readFeedbackAdminMode(process.env) !== "local")
    throw new Error("Local feedback and administration are disabled.");
}
