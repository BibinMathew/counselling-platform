"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfileRole } from "@/modules/identity/server/access";
import { localOperation, LocalOperationError } from "@/lib/supabase/local-operation";
import { feedbackInput, type FormState } from "./model";
export async function submitFeedback(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireProfileRole("customer");
  const parsed = feedbackInput.safeParse({
    bookingId: form.get("bookingId"),
    rating: Number(form.get("rating")),
    comment: form.get("comment") ?? "",
    acknowledged: form.get("acknowledged") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose 1–5 stars, use at most 2,000 characters and confirm fictional content.",
    };
  try {
    const input = parsed.data;
    const result = await localOperation(
      "phase9_submit_feedback",
      {
        p_actor: actor.id,
        p_booking: input.bookingId,
        p_rating: input.rating,
        p_comment: input.comment,
        p_ack: input.acknowledged,
      },
      z.object({ id: z.string().uuid(), result: z.enum(["saved", "existing", "conflict"]) }),
    );
    if (result.result !== "conflict") {
      revalidatePath("/bookings");
      revalidatePath("/admin/feedback");
    }
    return {
      status: result.result,
      id: result.id,
      message:
        result.result === "conflict"
          ? "Feedback was already submitted. Your draft is kept; reload your receipt."
          : result.result === "existing"
            ? "Your feedback was already saved."
            : "Your private feedback was saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof LocalOperationError && error.code === "23514"
          ? "Feedback is not available for this appointment yet. Your draft is kept."
          : "Feedback is unavailable. Your draft is kept; retry or reload your receipt.",
    };
  }
}
export async function reviewFeedback(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireProfileRole("admin");
  try {
    const id = z.string().uuid().parse(form.get("feedbackId"));
    await localOperation(
      "phase9_review_feedback",
      { p_actor: actor.id, p_feedback: id },
      z.object({ reviewed: z.boolean() }),
    );
    revalidatePath("/admin/feedback");
    revalidatePath("/admin");
    return { status: "saved", message: "Review acknowledged." };
  } catch {
    return { status: "error", message: "Review could not be acknowledged. Please retry." };
  }
}
