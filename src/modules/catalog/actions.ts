"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireProfileRole } from "@/modules/identity/server/access";

export type CatalogActionState = { status: "idle" | "error" | "success"; message: string };

const schema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]),
  profile_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(120),
  bio: z.string().trim().min(1).max(3000),
  qualifications: z.string().trim().min(1).max(1000),
  experience: z.string().trim().min(1).max(500),
  specialties: z.string().trim().min(1).max(1000),
  languages: z.string().trim().min(1).max(500),
  photo_url: z
    .string()
    .trim()
    .max(2048)
    .url()
    .refine((value) => value.startsWith("https://")),
});

export async function saveCounselor(
  _state: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  await requireProfileRole("admin");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Check the fields and enter a valid HTTPS image link and counselor account ID.",
    };
  const { id, profile_id, ...fields } = parsed.data;
  const values = { ...fields, published: formData.get("published") === "on" };
  const supabase = await createSupabaseServerClient();
  const result = id
    ? await supabase.from("counselors").update(values).eq("id", id).select("id").maybeSingle()
    : await supabase
        .from("counselors")
        .insert({ ...values, profile_id })
        .select("id")
        .maybeSingle();
  if (result.error || !result.data)
    return {
      status: "error",
      message: "The profile could not be saved. Check the counselor role and account ID.",
    };
  revalidatePath("/counselors");
  revalidatePath(`/counselors/${result.data.id}`);
  revalidatePath("/admin/counselors");
  return { status: "success", message: "Counselor profile saved." };
}

export async function deleteCounselor(
  _state: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  await requireProfileRole("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Invalid counselor profile." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("counselors")
    .delete()
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "The profile could not be deleted." };
  revalidatePath("/counselors");
  revalidatePath(`/counselors/${id.data}`);
  revalidatePath("/admin/counselors");
  return { status: "success", message: "Counselor profile deleted." };
}
