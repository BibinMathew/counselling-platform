import { execFileSync } from "node:child_process";

export function localSettings(): Record<string, string> {
  const status = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? {
        API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    : JSON.parse(
        execFileSync("supabase", ["status", "--output", "json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
  if (!status.API_URL || !["127.0.0.1", "localhost"].includes(new URL(status.API_URL).hostname))
    throw new Error("Tests require local Supabase");
  return status;
}
export function localDb(sql: string): string {
  localSettings();
  const docker = process.env.LOCAL_SUPABASE_RANCHER === "1" ? "rdctl" : "docker";
  const prefix = process.env.LOCAL_SUPABASE_RANCHER === "1" ? ["shell", "--", "docker"] : [];
  return execFileSync(
    docker,
    [
      ...prefix,
      "exec",
      "-i",
      "supabase_db_counselling-platform",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
