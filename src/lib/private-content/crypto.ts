import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ContentKeys } from "./config";
export const noteEnvelopeSchema = z
  .object({
    format: z.literal(1),
    key_id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    iv: z.string().max(24),
    tag: z.string().max(32),
    ciphertext: z.string().max(110000),
  })
  .strict();
export type NoteEnvelope = z.infer<typeof noteEnvelopeSchema>;
export type NoteBinding = {
  noteId: string;
  bookingId: string;
  counselorId: string;
  version: number;
};
function aad(b: NoteBinding) {
  return Buffer.from(
    JSON.stringify(["session-note", 1, b.noteId, b.bookingId, b.counselorId, b.version]),
  );
}
function key(keys: ContentKeys, id: string, purpose: string) {
  const original = Object.hasOwn(keys.keys, id) ? keys.keys[id] : null;
  if (!original) throw 0;
  return createHmac("sha256", original).update(`workspace/session-note/${purpose}/v1`).digest();
}
function decoded(value: string, length?: number) {
  const buffer = Buffer.from(value, "base64");
  if (buffer.toString("base64") !== value || (length !== undefined && buffer.length !== length))
    throw 0;
  return buffer;
}
export function validateNoteText(value: string) {
  const text = value.trim();
  if (!text || Array.from(text).length > 20000)
    throw new Error("Enter between 1 and 20,000 characters of fictional test notes.");
  return text;
}
export function sealNote(text: string, keys: ContentKeys, binding: NoteBinding): NoteEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keys, keys.activeId, "encryption"), iv);
  cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([cipher.update(validateNoteText(text), "utf8"), cipher.final()]);
  return {
    format: 1,
    key_id: keys.activeId,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}
export function openNote(input: unknown, keys: ContentKeys, binding: NoteBinding): string {
  try {
    const env = noteEnvelopeSchema.parse(input);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(keys, env.key_id, "encryption"),
      decoded(env.iv, 12),
    );
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(decoded(env.tag, 16));
    return validateNoteText(
      Buffer.concat([decipher.update(decoded(env.ciphertext)), decipher.final()]).toString("utf8"),
    );
  } catch {
    throw new Error("Private content unavailable.");
  }
}
export function noteDigests(
  text: string,
  expectedVersion: number,
  keys: ContentKeys,
  bookingId: string,
  counselorId: string,
): Record<string, string> {
  const input = JSON.stringify([bookingId, counselorId, expectedVersion, validateNoteText(text)]);
  return Object.fromEntries(
    Object.keys(keys.keys).map((id) => [
      id,
      createHmac("sha256", key(keys, id, "idempotency"))
        .update(input)
        .digest("hex"),
    ]),
  );
}
