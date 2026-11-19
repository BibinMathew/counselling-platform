import "server-only";
export function readWorkspaceMode(env: Record<string, string | undefined>): "disabled" | "local" {
  const mode = env.COUNSELOR_WORKSPACE_MODE ?? "disabled";
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
    throw new Error("Workspace requires local development configuration.");
  }
}
export type ContentKeys = { activeId: string; keys: Record<string, Buffer> };
export function readContentKeys(env: Record<string, string | undefined>): ContentKeys {
  try {
    const activeId = env.PRIVATE_CONTENT_ACTIVE_KEY_ID ?? "";
    const raw: unknown = JSON.parse(env.PRIVATE_CONTENT_KEYS ?? "");
    if (
      !/^[A-Za-z0-9_-]{1,40}$/.test(activeId) ||
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    )
      throw 0;
    const entries = Object.entries(raw);
    if (entries.length < 1 || entries.length > 10) throw 0;
    const keys: Record<string, Buffer> = Object.create(null);
    for (const [id, value] of entries) {
      if (
        !/^[A-Za-z0-9_-]{1,40}$/.test(id) ||
        typeof value !== "string" ||
        !/^[a-fA-F0-9]{64}$/.test(value)
      )
        throw 0;
      keys[id] = Buffer.from(value, "hex");
    }
    if (!Object.hasOwn(keys, activeId)) throw 0;
    return { activeId, keys };
  } catch {
    throw new Error("Private content keys unavailable.");
  }
}
