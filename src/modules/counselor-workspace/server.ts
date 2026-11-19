import "server-only";
import { z } from "zod";
import { readWorkspaceMode } from "@/lib/private-content/config";
import { requireProfileRole } from "@/modules/identity/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionSchema, workspaceSchema, workspaceQuery, type WorkspaceQuery } from "./model";
export function requireLocalWorkspace() {
  if (readWorkspaceMode(process.env) === "disabled")
    throw new Error("Synthetic workspace is disabled.");
}
export async function getWorkspace(input: WorkspaceQuery) {
  requireLocalWorkspace();
  await requireProfileRole("counselor");
  const query = workspaceQuery(input);
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_counselor_workspace", {
    p_view: query.view,
    p_page: query.page,
  });
  if (error) throw new Error("Sessions unavailable.");
  return { ...workspaceSchema.parse(data), ...query };
}
export async function getSession(bookingId: string) {
  requireLocalWorkspace();
  const profile = await requireProfileRole("counselor");
  const parsed = z.string().uuid().safeParse(bookingId);
  if (!parsed.success) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_counselor_session", { p_booking_id: parsed.data });
  if (error) throw new Error("Session unavailable.");
  return data ? { profile, session: sessionSchema.parse(data) } : null;
}
