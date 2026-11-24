import "server-only";

import type { Database } from "@/types/database.types";
import type { CounselorCategory } from "@/modules/catalog/categories";

export type PublicCounselor = Database["public"]["Views"]["public_counselors"]["Row"];

const demoIds = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
] as const;

export const demoCounselors: PublicCounselor[] = [
  {
    id: demoIds[0],
    display_name: "Demo Counselor 01",
    category: "consultant_psychologist" satisfies CounselorCategory,
    bio: "Fictional profile text for previewing how the public counselor profile will look.",
    qualifications: "Sample qualification — replace with verified details before publication.",
    experience: "Fictional UX sample; not a real therapist.",
    specialties: "Illustrative profile content only.",
    languages: "Malayalam, English",
    photo_url: "/images/demo/counselor-01.jpg",
  },
  {
    id: demoIds[1],
    display_name: "Demo Counselor 02",
    category: "clinical_psychologist" satisfies CounselorCategory,
    bio: "Fictional profile text for previewing how the public counselor profile will look.",
    qualifications: "Sample qualification — replace with verified details before publication.",
    experience: "Fictional UX sample; not a real therapist.",
    specialties: "Illustrative profile content only.",
    languages: "Malayalam, English",
    photo_url: "/images/demo/counselor-02.jpg",
  },
  {
    id: demoIds[2],
    display_name: "Demo Counselor 03",
    category: "sexual_health" satisfies CounselorCategory,
    bio: "Fictional profile text for previewing how the public counselor profile will look.",
    qualifications: "Sample qualification — replace with verified details before publication.",
    experience: "Fictional UX sample; not a real therapist.",
    specialties: "Illustrative profile content only.",
    languages: "Malayalam, English",
    photo_url: "/images/demo/counselor-03.jpg",
  },
  {
    id: demoIds[3],
    display_name: "Demo Counselor 04",
    category: "psychiatrist" satisfies CounselorCategory,
    bio: "Fictional profile text for previewing how the public counselor profile will look.",
    qualifications: "Sample qualification — replace with verified details before publication.",
    experience: "Fictional UX sample; not a real therapist.",
    specialties: "Illustrative profile content only.",
    languages: "Malayalam, English",
    photo_url: "",
  },
];

export function readCatalogDemoMode(env: Record<string, string | undefined>) {
  const mode = env.CATALOG_DEMO_MODE ?? "disabled";
  if (mode === "disabled") return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (
      mode !== "local" ||
      !["development", "test"].includes(env.NODE_ENV ?? "") ||
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error();
    return true;
  } catch {
    throw new Error("Catalog demo profiles require local development and a loopback Supabase URL.");
  }
}

export function isCatalogDemoMode() {
  return readCatalogDemoMode(process.env);
}
