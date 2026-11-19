import "server-only";
import { z } from "zod";
import { requireFeedbackAdmin } from "@/lib/local-features";
import { createSupabaseServiceClient } from "./service";
export class LocalOperationError extends Error {
  constructor(public code: string) {
    super("Local operation unavailable.");
  }
}
export async function localOperation<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  requireFeedbackAdmin();
  const { data, error } = await createSupabaseServiceClient().rpc(name, args);
  if (error) throw new LocalOperationError(error.code);
  return schema.parse(data);
}
