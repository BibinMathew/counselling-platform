export function readNotificationConfig(env: Record<string, string | undefined>): {
  mode: "disabled" | "simulator";
  appOrigin: string;
} {
  const mode = env.NOTIFICATION_MODE ?? "disabled";
  if (mode === "disabled") return { mode, appOrigin: "" };
  if (mode !== "simulator" || !["development", "test"].includes(env.NODE_ENV ?? ""))
    throw new Error("Notifications require a local development simulator");
  const loopback = (input: string) => {
    const url = new URL(input);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error("Notifications require HTTP loopback origins");
    return url.origin;
  };
  loopback(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  return { mode, appOrigin: loopback(env.NOTIFICATION_APP_ORIGIN ?? "http://127.0.0.1:3000") };
}
