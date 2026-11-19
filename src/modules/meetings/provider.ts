import { z } from "zod";
import { canonicalMeetingUrl } from "./model";
export type MeetingAssignment = { bookingId: string; url: string };
export interface MeetingProvider {
  assign(input: MeetingAssignment): Promise<void>;
}
// Future authorized Calendar implementations can supply this same domain boundary.
export function createManualMeetingProvider(
  save: (input: MeetingAssignment) => Promise<void>,
): MeetingProvider {
  return {
    async assign(input) {
      await save({
        bookingId: z.string().uuid().parse(input.bookingId),
        url: canonicalMeetingUrl(input.url),
      });
    },
  };
}
