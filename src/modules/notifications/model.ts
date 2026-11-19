import { z } from "zod";
export const notificationSchema = z.object({
  id: z.string().uuid(),
  booking_id: z.string().uuid(),
  channel: z.enum(["email", "whatsapp"]),
  template: z.string(),
  status: z.enum([
    "queued",
    "processing",
    "retrying",
    "delivered",
    "failed",
    "skipped",
    "superseded",
  ]),
  due_at: z.string(),
  attempts: z.number().int(),
  error_code: z.string().nullable(),
});
export const receiptSchema = z.object({
  job_id: z.string().uuid(),
  channel: z.string(),
  destination: z.string(),
  subject: z.string(),
  body: z.string(),
  created_at: z.string(),
});

export function notificationPage(input: { page?: string; status?: string }) {
  const parsed = Number(input.page ?? 0);
  const page = Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 1000000 ? parsed : 0;
  return { page, failedOnly: input.status === "failed", from: page * 100, to: page * 100 + 99 };
}
