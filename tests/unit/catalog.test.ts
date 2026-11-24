import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  COUNSELOR_CATEGORIES,
  COUNSELOR_CATEGORY_VALUES,
  isCounselorCategory,
} from "@/modules/catalog/categories";
import { demoCounselors, readCatalogDemoMode } from "@/modules/catalog/demo";

test("counselor categories use the approved single-category options", () => {
  expect(COUNSELOR_CATEGORY_VALUES).toEqual([
    "consultant_psychologist",
    "clinical_psychologist",
    "sexual_health",
    "psychiatrist",
  ]);
  expect(COUNSELOR_CATEGORIES.map(({ label }) => label)).toEqual([
    "Consultant Psychologist",
    "Clinical Psychologist",
    "Sexual Health",
    "Psychiatrist",
  ]);
  expect(isCounselorCategory("sexual_health")).toBe(true);
  expect(isCounselorCategory("other")).toBe(false);
});

test("local catalog demo data is fictional and covers each category once", () => {
  expect(demoCounselors).toHaveLength(COUNSELOR_CATEGORY_VALUES.length);
  expect(new Set(demoCounselors.map(({ category }) => category))).toEqual(
    new Set(COUNSELOR_CATEGORY_VALUES),
  );
  expect(
    demoCounselors.every(
      ({ display_name, qualifications, experience }) =>
        display_name.startsWith("Demo Counselor") &&
        qualifications.includes("Sample qualification") &&
        experience.includes("Fictional UX sample"),
    ),
  ).toBe(true);
});

test("catalog demo mode is opt-in and limited to local development URLs", () => {
  expect(readCatalogDemoMode({})).toBe(false);
  const local = {
    CATALOG_DEMO_MODE: "local",
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  };
  expect(readCatalogDemoMode(local)).toBe(true);
  for (const extra of [
    { NODE_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321/path" },
    { CATALOG_DEMO_MODE: "enabled" },
  ])
    expect(() => readCatalogDemoMode({ ...local, ...extra })).toThrow();
});
