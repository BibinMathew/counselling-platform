import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { readContentKeys } from "@/lib/private-content/config";
import {
  noteEnvelopeSchema,
  openNote,
  sealNote,
  noteDigests,
  validateNoteText,
} from "@/lib/private-content/crypto";
import { requireLocalWorkspace } from "@/modules/counselor-workspace/server";
const storedSchema = z.object({
  id: z.string().uuid(),
  booking_id: z.string().uuid(),
  counselor_id: z.string().uuid(),
  version: z.number().int().positive(),
  envelope: noteEnvelopeSchema,
});
async function readStored(actor: string, booking: string) {
  const { data, error } = await createSupabaseServiceClient().rpc("read_session_note", {
    p_actor_id: actor,
    p_booking_id: booking,
  });
  if (error) throw new Error("Private notes unavailable.");
  return storedSchema.nullable().parse(data);
}
function binding(note: z.infer<typeof storedSchema>) {
  return {
    noteId: note.id,
    bookingId: note.booking_id,
    counselorId: note.counselor_id,
    version: note.version,
  };
}
export async function loadNoteForEditor(actor: string, booking: string) {
  requireLocalWorkspace();
  const keys = readContentKeys(process.env);
  const note = await readStored(actor, booking);
  return {
    body: note ? openNote(note.envelope, keys, binding(note)) : "",
    version: note?.version ?? 0,
  };
}
export type NoteActionState = {
  status: "idle" | "saved" | "conflict" | "error";
  message: string;
  version?: number;
};
export async function persistNote(
  actor: string,
  input: {
    bookingId: string;
    expectedVersion: number;
    requestId: string;
    body: string;
    acknowledged: boolean;
  },
): Promise<NoteActionState> {
  requireLocalWorkspace();
  if (!input.acknowledged)
    return {
      status: "error",
      message: "Confirm the fictional-content acknowledgement before saving.",
    };
  const keys = readContentKeys(process.env);
  const body = validateNoteText(input.body);
  const previous = await readStored(actor, input.bookingId);
  // Fail closed even if an open editor submits a forged version after corruption/key loss.
  if (previous) openNote(previous.envelope, keys, binding(previous));
  const noteId = previous?.id ?? randomUUID();
  const bookingId = previous?.booking_id ?? input.bookingId.toLowerCase();
  const envelope = sealNote(body, keys, {
    noteId,
    bookingId,
    counselorId: actor,
    version: input.expectedVersion + 1,
  });
  const { data, error } = await createSupabaseServiceClient().rpc("save_session_note", {
    p_actor_id: actor,
    p_booking_id: bookingId,
    p_note_id: noteId,
    p_expected_version: input.expectedVersion,
    p_request_id: input.requestId,
    p_envelope: envelope,
    p_digest_candidates: noteDigests(body, input.expectedVersion, keys, bookingId, actor),
    p_active_key_id: keys.activeId,
    p_acknowledged: input.acknowledged,
  });
  if (error) {
    if (error.code === "40001")
      return {
        status: "conflict",
        message:
          "A newer note was saved. Your draft is kept. Reload the saved note before trying again.",
      };
    throw new Error("Private notes unavailable.");
  }
  const result = z
    .object({
      accepted_version: z.number().int().positive(),
      current_version: z.number().int().positive(),
      replayed: z.boolean(),
    })
    .parse(data);
  if (result.current_version !== result.accepted_version)
    return {
      status: "conflict",
      message:
        "This request was saved earlier, but a newer note now exists. Your draft is kept. Reload the saved note.",
    };
  return {
    status: "saved",
    version: result.current_version,
    message: `Private note saved (version ${result.current_version}).`,
  };
}
