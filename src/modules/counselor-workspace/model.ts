import { z } from "zod";
export type WorkspaceQuery = { view?: string | string[]; page?: string | string[] };
export function workspaceQuery(input: WorkspaceQuery) {
  return {
    view: input.view === "past" ? ("past" as const) : ("upcoming" as const),
    page:
      typeof input.page === "string" && /^(0|[1-9][0-9]{0,5})$/.test(input.page)
        ? Number(input.page)
        : 0,
  };
}
export const sessionSchema = z.object({
  id: z.string().uuid(),
  customer_name: z.string(),
  start_at: z.iso.datetime({ offset: true }),
  end_at: z.iso.datetime({ offset: true }),
  status: z.literal("confirmed"),
  is_past: z.boolean(),
  in_progress: z.boolean(),
  meeting_url: z.string().nullable(),
});
export const workspaceSchema = z.object({
  as_of: z.iso.datetime({ offset: true }),
  items: z.array(sessionSchema).max(20),
  has_more: z.boolean(),
});
export function sessionTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
