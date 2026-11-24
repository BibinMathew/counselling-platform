export const COUNSELOR_CATEGORY_VALUES = [
  "consultant_psychologist",
  "clinical_psychologist",
  "sexual_health",
  "psychiatrist",
] as const;

export type CounselorCategory = (typeof COUNSELOR_CATEGORY_VALUES)[number];

export const COUNSELOR_CATEGORIES: {
  value: CounselorCategory;
  label: string;
}[] = [
  { value: "consultant_psychologist", label: "Consultant Psychologist" },
  { value: "clinical_psychologist", label: "Clinical Psychologist" },
  { value: "sexual_health", label: "Sexual Health" },
  { value: "psychiatrist", label: "Psychiatrist" },
];

export function isCounselorCategory(value: unknown): value is CounselorCategory {
  return (
    typeof value === "string" && COUNSELOR_CATEGORY_VALUES.some((category) => category === value)
  );
}

export function getCounselorCategoryLabel(value: string) {
  return COUNSELOR_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}
