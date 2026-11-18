import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
const rancher = process.env.LOCAL_SUPABASE_RANCHER === "1";
const container = process.env.LOCAL_SUPABASE_CONTAINER ?? "supabase_db_counselling-platform";
const command = rancher ? "rdctl" : "docker";
const prefix = rancher ? ["shell", "--", "docker"] : [];
let count = 0;
for (const file of readdirSync("supabase/tests")
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  const output = execFileSync(
    command,
    [
      ...prefix,
      "exec",
      "-i",
      container,
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
    {
      input: readFileSync(`supabase/tests/${file}`, "utf8"),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  if (/^not ok\b/m.test(output) || /Looks like you (failed|planned)/.test(output))
    throw new Error(`Database assertions failed in ${file}:\n${output}`);
  const assertions = output.match(/^ok \d+\b/gm)?.length ?? 0;
  if (!assertions) throw new Error(`No assertions ran in ${file}`);
  count += assertions;
  console.log(`${file}: ${assertions} assertions passed`);
}
console.log(`Database suite: ${count} assertions passed; each fixture transaction rolled back.`);
