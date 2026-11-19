// Operator-only, opt-in commands. Never loaded by browser code.
import { pathToFileURL } from "node:url";
import { readDeployment } from "../src/lib/deployment.ts";
const marker = "littlehello-staging-v1";
const tables = [
  "profiles",
  "counselors",
  "bookings",
  "payment_orders",
  "session_notes",
  "appointment_feedback",
  "operational_cases",
  "notification_jobs",
  "synthetic_staging_settings",
];
/**
 * @param {string} command
 * @param {Record<string,string|undefined>} env
 * @param {(url:string, init:RequestInit)=>Promise<Response>} transport
 */
export async function runStagingCommand(command, env, transport = fetch) {
  if (
    ![
      "check",
      "seed",
      "configure-origin",
      "bootstrap-admin",
      "notifications",
      "reconcile",
    ].includes(command)
  )
    throw Error("Use check, seed, configure-origin, bootstrap-admin, notifications or reconcile.");
  const deployment = readDeployment(env);
  if (deployment.kind !== "staging" || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Explicit staging configuration and service credentials required.");
  const mutation = command !== "check";
  if (
    mutation &&
    (env.STAGING_TARGET_CONFIRM !== "wajqgyhugvcorgxgrdlv" ||
      env.STAGING_SCHEMA_VERIFIED !== "20261127000000" ||
      env.STAGING_AUTH_LOCKED !== "yes")
  )
    throw Error(
      "Confirm staging target, reviewed migration head and locked Auth settings before writes.",
    );
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const dbRequest = async (path, options = {}) => {
    const response = await transport(base + path, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        ...options.headers,
      },
    });
    if (!response.ok)
      throw Error(
        `Staging operation failed (HTTP ${response.status}); inspect configuration without logging response bodies.`,
      );
    return response;
  };
  if (["notifications", "reconcile"].includes(command)) {
    const secret =
      command === "notifications" ? env.NOTIFICATION_WORKER_SECRET : env.PAYMENT_RECONCILE_SECRET;
    if (!secret || secret.length < 32 || !env.VERCEL_AUTOMATION_BYPASS_SECRET)
      throw Error("Configure worker and Vercel automation bypass credentials.");
    const path =
      command === "notifications" ? "/api/notifications/dispatch" : "/api/payments/reconcile";
    const response = await transport(deployment.appOrigin + path, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        authorization: `Bearer ${secret}`,
        "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET,
      },
    });
    if (!response.ok) throw Error(`Staging batch failed (HTTP ${response.status}).`);
    const result = await response.json();
    // Never echo arbitrary worker response content or headers.
    if (
      command === "notifications" &&
      ["checked", "delivered", "failed"].every(
        (k) => Number.isSafeInteger(result[k]) && result[k] >= 0,
      )
    )
      return { checked: result.checked, delivered: result.delivered, failed: result.failed };
    if (command === "reconcile") return { status: "batch-completed" };
    throw Error("Unexpected batch response.");
  }
  const usersResponse = await dbRequest("/auth/v1/admin/users?page=1&per_page=1000");
  const { users } = await usersResponse.json();
  if (!Array.isArray(users) || users.length >= 1000)
    throw Error("Unexpected account inventory; inspect read-only before proceeding.");
  const counts = {};
  for (const table of tables) {
    const r = await dbRequest(`/rest/v1/${table}?select=id`, {
      method: "HEAD",
      headers: { Prefer: "count=exact" },
    });
    const total = r.headers.get("content-range")?.split("/").at(-1);
    if (!total || !/^\d+$/.test(total)) throw Error("Staging schema/count preflight incomplete.");
    counts[table] = Number(total);
  }
  if (command === "check") return { status: "ready", users: users.length };
  if (command === "configure-origin") {
    await dbRequest("/rest/v1/synthetic_staging_settings?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: true, app_origin: deployment.appOrigin }),
    });
    return { status: "origin-configured" };
  }
  if (command === "bootstrap-admin") {
    const id = env.STAGING_BOOTSTRAP_ADMIN_ID;
    if (
      !id ||
      !deployment.userIds.includes(id) ||
      !users.some(
        (u) =>
          u.id === id &&
          u.app_metadata?.staging_seed === marker &&
          u.app_metadata?.staging_slot === "admin",
      )
    )
      throw Error("Select the owned synthetic admin account.");
    const response = await dbRequest(`/rest/v1/profiles?id=eq.${id}&select=role`);
    const rows = await response.json();
    if (rows[0]?.role === "admin") return { status: "admin-ready" };
    if (rows[0]?.role !== "customer") throw Error("Unexpected staging admin role.");
    await dbRequest("/rest/v1/rpc/bootstrap_first_admin", {
      method: "POST",
      body: JSON.stringify({
        p_target_user_id: id,
        p_reason: "Synthetic staging v1 initial administrator",
      }),
    });
    return { status: "admin-ready" };
  }
  if (
    deployment.phones.length !== 3 ||
    users.some((u) => u.app_metadata?.staging_seed !== marker) ||
    counts.profiles !== users.length ||
    [
      "counselors",
      "bookings",
      "payment_orders",
      "session_notes",
      "appointment_feedback",
      "operational_cases",
      "notification_jobs",
    ].some((t) => counts[t] > 0)
  )
    throw Error(
      "Account seed requires an empty or partially seeded owned synthetic project; inspect unexpected data without overwriting it.",
    );
  const result = [];
  for (const [index, role] of ["customer", "counselor", "admin"].entries()) {
    const phone = deployment.phones[index];
    let user = users.find((u) => `+${String(u.phone).replace(/^\+/, "")}` === phone);
    if (user && user.app_metadata?.staging_slot !== role)
      throw Error("Synthetic seed account ownership conflict.");
    if (!user) {
      const response = await dbRequest("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          phone,
          phone_confirm: true,
          app_metadata: { staging_seed: marker, staging_slot: role },
          user_metadata: { preferred_name: `Demo ${role}` },
        }),
      });
      const payload = await response.json();
      user = payload.user ?? payload;
    }
    if (!/^[0-9a-f-]{36}$/i.test(user.id ?? ""))
      throw Error("Invalid provisioned account identifier.");
    result.push({ id: user.id, intendedRole: role });
  }
  return { status: "accounts-ready", accounts: result };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runStagingCommand(process.argv[2] ?? "check", process.env)));
  } catch {
    console.error(
      "Staging command failed; check target, confirmations, schema/Auth settings and credentials. No response bodies are logged.",
    );
    process.exitCode = 1;
  }
}
