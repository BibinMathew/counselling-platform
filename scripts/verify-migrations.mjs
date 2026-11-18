import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const rancher = process.env.LOCAL_SUPABASE_RANCHER === "1";
const command = rancher ? "rdctl" : "docker";
const prefix = [
  ...(rancher ? ["shell", "--", "docker"] : []),
  "exec",
  "-i",
  process.env.LOCAL_SUPABASE_CONTAINER ?? "supabase_db_counselling-platform",
];
const database = `phase5_replay_${randomBytes(6).toString("hex")}`;
function psql(db, sql) {
  return execFileSync(
    command,
    [...prefix, "psql", "-U", "postgres", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
// Schema only: no customer rows are exported. Cluster roles already exist in this server.
const dump = execFileSync(
  command,
  [
    ...prefix,
    "pg_dump",
    "-U",
    "postgres",
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--schema=auth",
    "--schema=extensions",
    "postgres",
  ],
  { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
);
// Application trigger is defined by migration 1, not part of the Supabase baseline.
const baseline = dump.replace(/^CREATE TRIGGER on_auth_user_created[^;]*;\n/gm, "");
try {
  psql("postgres", `create database ${database} template template0;`);
  psql(database, baseline);
  psql(database, "create extension if not exists pgcrypto with schema extensions;");
  psql(
    database,
    "grant usage on schema public,auth,extensions to anon,authenticated,service_role; grant all on schema public to postgres,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role;",
  );
  let count = 0;
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    psql(database, readFileSync(`supabase/migrations/${name}`, "utf8"));
    count++;
  }
  console.log(
    `Replayed ${count} migrations on isolated database ${database}; no existing data changed.`,
  );
} finally {
  psql("postgres", `drop database if exists ${database} with (force);`);
}
