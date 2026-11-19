// Explicit local operator runner. Load ignored configuration through the package script.
import { setTimeout as delay } from "node:timers/promises";
const command = process.argv[2] ?? "run";
if (!["run", "poll"].includes(command)) throw new Error("Use run or poll");
const origin = new URL(process.env.NOTIFICATION_APP_ORIGIN ?? "http://127.0.0.1:3000");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error("Local app origin required");
const secret = process.env.NOTIFICATION_WORKER_SECRET ?? "";
if (secret.length < 32) throw new Error("Configure a local notification worker secret");
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => controller.abort());
do {
  try {
    const response = await fetch(`${origin.origin}/api/notifications/dispatch`, {
      method: "POST",
      redirect: "error",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) throw new Error("Worker endpoint unavailable");
    const result = await response.json();
    console.log(
      result.paused
        ? "Local notification delivery paused."
        : `Local batch: checked ${result.checked}, delivered ${result.delivered}, failed/retrying ${result.failed}`,
    );
  } catch {
    if (controller.signal.aborted) break;
    console.error("Local notification batch failed; check app and worker configuration.");
    if (command === "run") {
      process.exitCode = 1;
      break;
    }
  }
  if (command === "run") break;
  try {
    await delay(5000, undefined, { signal: controller.signal });
  } catch {
    break;
  }
} while (!controller.signal.aborted);
