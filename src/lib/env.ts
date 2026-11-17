import { z } from "zod";

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function parseSupabasePublicEnv(env: Record<string, string | undefined>) {
  return supabasePublicEnvSchema.parse(env);
}

export function getSupabasePublicEnv() {
  return parseSupabasePublicEnv(process.env);
}
