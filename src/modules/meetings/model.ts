import { z } from "zod";
export function canonicalMeetingUrl(input: string): string {
  const value = input.trim();
  if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(value))
    throw new Error("Enter a canonical Google Meet link.");
  return value;
}
export const meetingSchema = z.object({
  booking_id: z.string().uuid(),
  meeting_url: z.string(),
  revision: z.number().int(),
});
export const appointmentSchema = z.object({
  id: z.string().uuid(),
  start_at: z.string(),
  end_at: z.string().optional(),
  counselor_name: z.string().optional(),
  meeting_url: z.string().nullable(),
});
