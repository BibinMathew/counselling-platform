"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfileRole } from "@/modules/identity/server/access";
import { LocalOperationError, localOperation } from "@/lib/supabase/local-operation";
import { caseOpenInput, caseUpdateInput } from "./model";
import type { FormState } from "@/modules/feedback/model";
export async function openCase(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireProfileRole("admin");
  const parsed = caseOpenInput.safeParse({
    sourceType: form.get("sourceType"),
    sourceId: form.get("sourceId"),
    remark: form.get("remark") ?? "",
    acknowledged: form.get("acknowledged") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose a valid source, use at most 1,000 characters and confirm fictional content.",
    };
  try {
    const i = parsed.data;
    const data = await localOperation(
      "phase9_open_case",
      {
        p_actor: actor.id,
        p_source_type: i.sourceType,
        p_source_id: i.sourceId,
        p_remark: i.remark,
        p_ack: i.acknowledged,
      },
      z.object({ id: z.string().uuid(), version: z.number().int(), existing: z.boolean() }),
    );
    revalidatePath("/admin/exceptions");
    revalidatePath("/admin");
    return {
      status: "saved",
      id: data.id,
      message: data.existing
        ? "A case already exists for this source."
        : "Operational case opened.",
    };
  } catch {
    return {
      status: "error",
      message: "Case could not be opened. Check the source and retry; your draft is kept.",
    };
  }
}
export async function updateCase(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireProfileRole("admin");
  const parsed = caseUpdateInput.safeParse({
    caseId: form.get("caseId"),
    expectedVersion: Number(form.get("expectedVersion")),
    requestId: form.get("requestId"),
    action: form.get("action"),
    remark: form.get("remark") ?? "",
    acknowledged: form.get("acknowledged") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message:
        "Choose an action, use at most 1,000 characters, add a close/reopen remark and confirm fictional content.",
    };
  try {
    const i = parsed.data;
    const result = await localOperation(
      "phase9_update_case",
      {
        p_actor: actor.id,
        p_case: i.caseId,
        p_expected: i.expectedVersion,
        p_request: i.requestId,
        p_action: i.action,
        p_remark: i.remark,
        p_ack: i.acknowledged,
      },
      z.object({
        accepted_version: z.number().int(),
        current_version: z.number().int(),
        replayed: z.boolean(),
      }),
    );
    if (result.current_version !== result.accepted_version)
      return {
        status: "conflict",
        message:
          "This request was accepted earlier, but the case changed again. Your draft is kept; reload the case.",
      };
    revalidatePath("/admin/exceptions");
    revalidatePath(`/admin/exceptions/${i.caseId}`);
    revalidatePath("/admin");
    return {
      status: "saved",
      version: result.current_version,
      message: `Case updated (version ${result.current_version}).`,
    };
  } catch (error) {
    if (error instanceof LocalOperationError && error.code === "40001")
      return {
        status: "conflict",
        message: "The case changed. Your draft is kept; reload before updating.",
      };
    return {
      status: "error",
      message:
        "Case update unavailable or invalid. Your draft is kept; retry the same request or reload.",
    };
  }
}
