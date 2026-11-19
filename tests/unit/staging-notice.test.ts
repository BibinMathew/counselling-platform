import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/server", () => ({ connection: async () => {} }));
import { StagingNotice } from "@/components/staging-notice";
test("staging notice explains fake payments and manual delivery without exposing configuration", async () => {
  for (const [key, value] of Object.entries({
    APP_ENV: "staging",
    VERCEL_ENV: "preview",
    VERCEL_URL: "littlehello-preview.vercel.app",
    STAGING_APP_ORIGIN: "https://littlehello-preview.vercel.app",
    NEXT_PUBLIC_SUPABASE_URL: "https://wajqgyhugvcorgxgrdlv.supabase.co",
    STAGING_ALLOWED_USER_IDS: "fa100000-0000-4000-8000-000000000001",
    STAGING_ALLOWED_PHONES: "+919000001001",
  }))
    vi.stubEnv(key, value);
  const markup = renderToStaticMarkup(await StagingNotice());
  expect(markup).toContain("no money is collected");
  expect(markup).toContain("batches run manually");
  expect(markup).not.toContain("fa100000");
  expect(markup).not.toContain("supabase.co");
  expect(markup).not.toContain("9000001001");
  vi.unstubAllEnvs();
  expect(await StagingNotice()).toBeNull();
});
