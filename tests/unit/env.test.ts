import { describe, expect, it } from "vitest";
import { parseSupabasePublicEnv } from "@/lib/env";

describe("Supabase public environment", () => {
  it("accepts a local URL and public key", () => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-development-anon-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-development-anon-key",
    });
  });

  it("rejects an invalid URL", () => {
    expect(() =>
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-development-anon-key",
      }),
    ).toThrow();
  });
});
