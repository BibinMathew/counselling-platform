import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/catalog/server/catalog", () => ({ getPublicCounselors: vi.fn() }));
vi.mock("@/modules/catalog/demo", () => ({ isCatalogDemoMode: () => false }));

import { HomeCounselorShowcase } from "@/modules/catalog/components/home-counselor-showcase";
import { getPublicCounselors } from "@/modules/catalog/server/catalog";

test("empty catalog preserves the selected category and provides an all-categories reset", async () => {
  vi.mocked(getPublicCounselors).mockResolvedValue([]);
  const content = await HomeCounselorShowcase({
    searchParams: Promise.resolve({ category: "clinical_psychologist" }),
  });
  const html = renderToStaticMarkup(content);
  expect(html).toContain("No counselor profiles are available in this category yet.");
  expect(html).toContain('aria-current="page" href="/?category=clinical_psychologist#counsellors"');
  expect(html).toContain('href="/#counsellors">All</a>');
});
