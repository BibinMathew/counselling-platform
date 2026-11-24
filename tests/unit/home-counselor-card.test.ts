import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/home/session-facts", () => ({
  SessionFacts: () => createElement("span", null, "45-minute sessions · ₹699"),
}));

import { CounselorCard } from "@/modules/catalog/components/counselor-card";
import { demoCounselors } from "@/modules/catalog/demo";

test("home cards link real profiles to their available times and show current session facts", () => {
  const counselor = demoCounselors[0];
  const html = renderToStaticMarkup(createElement(CounselorCard, { counselor, variant: "home" }));
  expect(html).toContain(`/counselors/${counselor.id}#available-times`);
  expect(html).toContain("Book session");
  expect(html).toContain("45-minute sessions · ₹699");
  expect(html).toContain(counselor.qualifications);
  expect(html).toContain(counselor.specialties);
});

test("fictional home cards are labeled and cannot be booked", () => {
  const html = renderToStaticMarkup(
    createElement(CounselorCard, { counselor: demoCounselors[0], variant: "home", demoMode: true }),
  );
  expect(html).toContain("Fictional sample");
  expect(html).not.toContain("Book session");
  expect(html).not.toContain("₹699");
});
