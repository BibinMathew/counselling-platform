/** Server/operator policy. Never pass this configuration into browser props. */
type Env = Record<string, string | undefined>;
export type Deployment =
  | { kind: "local" | "production" }
  | { kind: "staging"; appOrigin: string; userIds: string[]; phones: string[] };
export const STAGING_SUPABASE_URL = "https://wajqgyhugvcorgxgrdlv.supabase.co";
function list(value: string | undefined, pattern: RegExp) {
  const values = value?.split(",").map((v) => v.trim()) ?? [];
  if (
    !values.length ||
    values.length > 12 ||
    values.some((v) => !pattern.test(v)) ||
    new Set(values).size !== values.length
  )
    throw new Error("Invalid staging configuration.");
  return values;
}
export function readDeployment(env: Env): Deployment {
  if (env.APP_ENV === "staging") {
    try {
      const origin = env.STAGING_APP_ORIGIN ?? "";
      const url = new URL(origin);
      if (
        env.VERCEL_ENV !== "preview" ||
        env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_SUPABASE_URL ||
        url.origin !== origin ||
        url.protocol !== "https:" ||
        url.port ||
        !url.hostname.endsWith(".vercel.app") ||
        ![env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean).includes(url.host)
      )
        throw 0;
      return {
        kind: "staging",
        appOrigin: origin,
        userIds: list(
          env.STAGING_ALLOWED_USER_IDS,
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        phones: list(env.STAGING_ALLOWED_PHONES, /^\+91[6-9]\d{9}$/),
      };
    } catch {
      throw new Error("Invalid staging configuration.");
    }
  }
  // A dedicated staging database or leftover staging config must never silently
  // fall back to unrestricted core identity when deployment flags are missing.
  let stagingTarget = false;
  try {
    stagingTarget =
      new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname === "wajqgyhugvcorgxgrdlv.supabase.co";
  } catch {
    /* Normal public-env validation handles other malformed URLs. */
  }
  if (
    stagingTarget ||
    Object.entries(env).some(([key, value]) => key.startsWith("STAGING_") && Boolean(value))
  )
    throw new Error("Staging configuration requires an approved preview deployment.");
  if (env.APP_ENV && !["local", "production"].includes(env.APP_ENV))
    throw new Error("Invalid deployment environment.");
  if (env.APP_ENV === "local" && (env.VERCEL_ENV || env.NODE_ENV === "production"))
    throw new Error("Local deployment requires a local runtime.");
  return {
    kind:
      env.APP_ENV === "production" || env.VERCEL_ENV || env.NODE_ENV === "production"
        ? "production"
        : "local",
  };
}
export function requireSyntheticRuntime(env: Env): Deployment {
  const deployment = readDeployment(env);
  if (deployment.kind === "staging") return deployment;
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (
    deployment.kind !== "local" ||
    !["development", "test"].includes(env.NODE_ENV ?? "") ||
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Synthetic features require local or approved staging configuration.");
  return deployment;
}
export function isStagingUserAllowed(env: Env, userId: string): boolean {
  const deployment = readDeployment(env);
  return deployment.kind !== "staging" || deployment.userIds.includes(userId);
}
/** Return null to deny before calling Auth; staging never creates a user from a browser request. */
export function phoneOtpOptions(env: Env, phone: string): { shouldCreateUser: boolean } | null {
  const deployment = readDeployment(env);
  if (deployment.kind !== "staging") return { shouldCreateUser: true };
  return deployment.phones.includes(phone) ? { shouldCreateUser: false } : null;
}
export function readPrivateFeatureMode(env: Env, key: string): "disabled" | "local" | "staging" {
  const mode = env[key] ?? "disabled";
  if (mode === "disabled") return mode;
  const deployment = requireSyntheticRuntime(env);
  if (
    (mode === "local" && deployment.kind === "local") ||
    (mode === "staging" && deployment.kind === "staging")
  )
    return mode;
  throw new Error("Private features require explicit local or staging mode.");
}
export function isDeploymentRequestAllowed(env: Env, requestUrl: string): boolean {
  const deployment = readDeployment(env);
  if (deployment.kind !== "staging") return true;
  try {
    return new URL(requestUrl).origin === deployment.appOrigin;
  } catch {
    return false;
  }
}
