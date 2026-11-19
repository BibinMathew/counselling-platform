import "server-only";
import { readPrivateFeatureMode } from "@/lib/deployment";
export function readWorkspaceMode(env: Record<string, string | undefined>) {
  return readPrivateFeatureMode(env, "COUNSELOR_WORKSPACE_MODE");
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
