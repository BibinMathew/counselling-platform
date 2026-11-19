import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readWorkspaceMode, readContentKeys } from "@/lib/private-content/config";
import { sealNote, openNote, noteDigests, validateNoteText } from "@/lib/private-content/crypto";
const local = {
  NODE_ENV: "test",
  COUNSELOR_WORKSPACE_MODE: "local",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
};
const env = {
  PRIVATE_CONTENT_ACTIVE_KEY_ID: "v1",
  PRIVATE_CONTENT_KEYS: JSON.stringify({ v1: "a".repeat(64) }),
};
const binding = {
  noteId: "f8000000-0000-4000-8000-000000000001",
  bookingId: "f8000000-0000-4000-8000-000000000002",
  counselorId: "f8000000-0000-4000-8000-000000000003",
  version: 1,
};
test("workspace defaults disabled and refuses hosted/production mode", () => {
  expect(readWorkspaceMode({})).toBe("disabled");
  expect(readWorkspaceMode(local)).toBe("local");
  for (const overrides of [
    { NODE_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://remote.supabase.co" },
    { COUNSELOR_WORKSPACE_MODE: "enabled" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://user:pass@localhost:54321" },
  ])
    expect(() => readWorkspaceMode({ ...local, ...overrides })).toThrow();
});
test("key configuration fails without exposing key input", () => {
  expect(readContentKeys(env).activeId).toBe("v1");
  for (const overrides of [
    { PRIVATE_CONTENT_ACTIVE_KEY_ID: "missing" },
    { PRIVATE_CONTENT_KEYS: "secret-invalid-json" },
    { PRIVATE_CONTENT_KEYS: JSON.stringify({ v1: "short-secret" }) },
  ]) {
    try {
      readContentKeys({ ...env, ...overrides });
      throw new Error("accepted invalid key");
    } catch (error) {
      expect(String(error)).toBe("Error: Private content keys unavailable.");
    }
  }
});
test("notes encrypt with random nonces and decrypt only with exact identity/version", () => {
  const keys = readContentKeys(env);
  const a = sealNote("Fictional note", keys, binding),
    b = sealNote("Fictional note", keys, binding);
  expect(a.iv).not.toBe(b.iv);
  expect(JSON.stringify(a)).not.toContain("Fictional note");
  expect(openNote(a, keys, binding)).toBe("Fictional note");
  for (const changed of [
    { ...binding, version: 2 },
    { ...binding, noteId: binding.bookingId },
    { ...binding, bookingId: binding.noteId },
    { ...binding, counselorId: binding.noteId },
  ])
    expect(() => openNote(a, keys, changed)).toThrow("Private content unavailable.");
  expect(() =>
    openNote({ ...a, tag: Buffer.alloc(16).toString("base64") }, keys, binding),
  ).toThrow();
  expect(() =>
    openNote({ ...a, ciphertext: Buffer.from("changed").toString("base64") }, keys, binding),
  ).toThrow();
  expect(() =>
    openNote({ ...a, iv: Buffer.alloc(12).toString("base64") }, keys, binding),
  ).toThrow();
});
test("retained keys allow reads and stable request identity after active-key rotation", () => {
  const original = readContentKeys(env);
  const encrypted = sealNote("Old fictional note", original, binding);
  const rotated = readContentKeys({
    ...env,
    PRIVATE_CONTENT_ACTIVE_KEY_ID: "v2",
    PRIVATE_CONTENT_KEYS: JSON.stringify({ v1: "a".repeat(64), v2: "b".repeat(64) }),
  });
  expect(openNote(encrypted, rotated, binding)).toBe("Old fictional note");
  expect(sealNote("New", rotated, binding).key_id).toBe("v2");
  expect(
    noteDigests("Old fictional note", 0, original, binding.bookingId, binding.counselorId).v1,
  ).toBe(noteDigests("Old fictional note", 0, rotated, binding.bookingId, binding.counselorId).v1);
  expect(noteDigests("Changed", 0, rotated, binding.bookingId, binding.counselorId).v1).not.toBe(
    noteDigests("Old fictional note", 0, rotated, binding.bookingId, binding.counselorId).v1,
  );
  const lost = readContentKeys({
    ...env,
    PRIVATE_CONTENT_ACTIVE_KEY_ID: "v2",
    PRIVATE_CONTENT_KEYS: JSON.stringify({ v2: "b".repeat(64) }),
  });
  expect(() => openNote(encrypted, lost, binding)).toThrow();
  const wrong = readContentKeys({
    ...env,
    PRIVATE_CONTENT_KEYS: JSON.stringify({ v1: "c".repeat(64) }),
  });
  expect(() => openNote(encrypted, wrong, binding)).toThrow();
});
test("note limits count Unicode code points and reject empty or oversized drafts", () => {
  expect(validateNoteText("  fictional\ntext  ")).toBe("fictional\ntext");
  expect(validateNoteText("😀".repeat(20000))).toHaveLength(40000);
  for (const text of [" ", "x".repeat(20001), "😀".repeat(20001)])
    expect(() => validateNoteText(text)).toThrow();
});
