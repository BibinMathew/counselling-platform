import { z } from "zod";
export const feedbackInput = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .refine((v) => Array.from(v).length <= 2000, "Use at most 2,000 characters.")
    .transform((v) => v || null),
  acknowledged: z.literal(true),
});
export type FormState = {
  status: "idle" | "saved" | "existing" | "conflict" | "error";
  message: string;
  version?: number;
  id?: string;
};
export const initialState: FormState = { status: "idle", message: "" };
export const receiptSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int(),
  comment: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});
export const feedbackPageSchema = z.object({
  as_of: z.string(),
  booking_id: z.string().uuid(),
  counselor_name: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  eligible: z.boolean(),
  receipt: receiptSchema.nullable(),
});
export const feedbackRowSchema = receiptSchema.extend({
  booking_id: z.string().uuid(),
  counselor_id: z.string().uuid(),
  counselor_name: z.string(),
  start_at: z.string(),
  customer_id: z.string().uuid(),
});
