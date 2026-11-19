import { expect, test } from "vitest";
import { parsePortalQuery, bookAgainHref, portalPageSchema } from "@/modules/customer-portal/model";
test("portal query validates untrusted filters and page bounds", () => {
  expect(parsePortalQuery({ view: "past", page: "2" })).toEqual({ view: "past", page: 2 });
  expect(parsePortalQuery({ view: "injected", page: "-1" })).toEqual({ view: "all", page: 0 });
  for (const page of ["1.5", "1e2", "Infinity", "abc", "99999999999999999"])
    expect(parsePortalQuery({ page }).page).toBe(0);
  expect(parsePortalQuery({ view: ["past", "all"], page: ["2"] })).toEqual({
    view: "all",
    page: 0,
  });
});
test("rebooking links use current counselor eligibility without creating state", () => {
  expect(
    bookAgainHref({
      counselor_id: "f6100000-0000-4000-8000-000000000001",
      counselor_bookable: true,
    }),
  ).toBe("/counselors/f6100000-0000-4000-8000-000000000001");
  expect(
    bookAgainHref({
      counselor_id: "f6100000-0000-4000-8000-000000000001",
      counselor_bookable: false,
    }),
  ).toBe("/counselors");
});
test("empty pages retain a database reference time and reject malformed results", () => {
  expect(
    portalPageSchema.parse({ as_of: "2026-11-19T10:00:00+00:00", items: [], has_more: false })
      .items,
  ).toEqual([]);
  expect(() => portalPageSchema.parse({ as_of: "invalid", items: [], has_more: false })).toThrow();
});

test("confirmation navigation validates a booking locator and ignores malformed IDs", () => {
  expect(parsePortalQuery({ booking: "f6100000-0000-4000-8000-000000000001" })).toEqual({
    view: "all",
    page: 0,
    booking: "f6100000-0000-4000-8000-000000000001",
  });
  expect(parsePortalQuery({ booking: "forged" })).toEqual({ view: "all", page: 0 });
});
