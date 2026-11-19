"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfileRole } from "@/modules/identity/server/access";
import { persistNote, type NoteActionState } from "./server";
export async function savePrivateNote(
  _state: NoteActionState,
  form: FormData,
): Promise<NoteActionState> {
  const profile = await requireProfileRole("counselor");
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      expectedVersion: z.coerce.number().int().min(0).max(1000000000),
      requestId: z.string().uuid(),
      body: z.string(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { status: "error", message: "Private note request is invalid. Your draft is kept." };
  try {
    const result = await persistNote(profile.id, {
      ...parsed.data,
      acknowledged: form.get("acknowledged") === "on",
    });
    if (result.status === "saved")
      revalidatePath(`/counselor/appointments/${parsed.data.bookingId}`);
    return result;
  } catch {
    return {
      status: "error",
      message:
        "Private notes are unavailable. Your draft is kept; check local keys/configuration or reload the saved note.",
    };
  }
}
