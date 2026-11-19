import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFeedbackAdminMode } from "@/lib/local-features";
import { feedbackInput } from "@/modules/feedback/model";
import { caseUpdateInput, listQuery } from "@/modules/admin-operations/model";
const id = "f9000000-0000-4000-8000-000000000001";
test("feedback/admin mode defaults disabled and fails closed outside local development", () => {
  expect(readFeedbackAdminMode({})).toBe("disabled");
  const local = {
    FEEDBACK_ADMIN_MODE: "local",
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  };
  expect(readFeedbackAdminMode(local)).toBe("local");
  for (const extra of [
    { NODE_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://host.test" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://a:b@localhost:54321" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321/path" },
    { FEEDBACK_ADMIN_MODE: "bad" },
  ])
    expect(() => readFeedbackAdminMode({ ...local, ...extra })).toThrow();
});
test("feedback accepts integer stars, trims blank text and bounds Unicode characters", () => {
  const input = { bookingId: id, rating: 5, comment: "  ", acknowledged: true };
  expect(feedbackInput.parse(input).comment).toBeNull();
  for (const rating of [0, 6, 1.5, "", null])
    expect(feedbackInput.safeParse({ ...input, rating }).success).toBe(false);
  expect(feedbackInput.safeParse({ ...input, comment: "😀".repeat(2000) }).success).toBe(true);
  expect(feedbackInput.safeParse({ ...input, comment: "😀".repeat(2001) }).success).toBe(false);
  expect(feedbackInput.safeParse({ ...input, acknowledged: false }).success).toBe(false);
});
test("case changes require valid identity, versions and bounded close/reopen remarks", () => {
  const input = {
    caseId: id,
    expectedVersion: 1,
    requestId: id,
    action: "close",
    remark: " Fictional follow-up ",
    acknowledged: true,
  };
  expect(caseUpdateInput.parse(input).remark).toBe("Fictional follow-up");
  for (const extra of [
    { remark: "" },
    { remark: "😀".repeat(1001) },
    { expectedVersion: 0 },
    { action: "delete" },
    { requestId: "bad" },
    { acknowledged: false },
  ])
    expect(caseUpdateInput.safeParse({ ...input, ...extra }).success).toBe(false);
  expect(caseUpdateInput.safeParse({ ...input, action: "start", remark: "" }).success).toBe(true);
});
test("list queries validate UUID, bounded page and filter enums", () => {
  expect(listQuery({}, ["all", "past"]).page).toBe(0);
  expect(listQuery({ view: "past", page: "2" }, ["all", "past"])).toMatchObject({
    view: "past",
    page: 2,
  });
  for (const input of [
    { page: "-1" },
    { page: "1000000" },
    { page: "1x" },
    { view: "bad" },
    { counselor: "bad" },
    { booking: ["bad"] },
  ])
    expect(() => listQuery(input, ["all", "past"])).toThrow();
});
