import { expect, test } from "vitest";
import { canonicalMeetingUrl } from "@/modules/meetings/model";
test("accepts only canonical manual Meet links", () => {
  expect(canonicalMeetingUrl(" https://meet.google.com/abc-defg-hij ")).toBe(
    "https://meet.google.com/abc-defg-hij",
  );
  for (const url of [
    "http://meet.google.com/abc-defg-hij",
    "https://meet.google.com.evil/abc-defg-hij",
    "https://user@meet.google.com/abc-defg-hij",
    "https://meet.google.com/abc-defg-hij?q=x",
    "https://meet.google.com/abc-defg-hij#x",
    "https://meet.google.com/abc-defg-hij/",
    "https://meet.google.com/ABC-DEFG-HIJ",
    "javascript:alert(1)",
  ])
    expect(() => canonicalMeetingUrl(url)).toThrow();
});

test("manual provider validates before persisting an assignment", async () => {
  const { createManualMeetingProvider } = await import("@/modules/meetings/provider");
  const saved: unknown[] = [];
  const provider = createManualMeetingProvider(async (input) => {
    saved.push(input);
  });
  await expect(
    provider.assign({
      bookingId: "f6000000-0000-4000-8000-000000000001",
      url: "https://evil.test/abc-defg-hij",
    }),
  ).rejects.toThrow();
  expect(saved).toEqual([]);
  await provider.assign({
    bookingId: "f6000000-0000-4000-8000-000000000001",
    url: " https://meet.google.com/abc-defg-hij ",
  });
  expect(saved).toEqual([
    {
      bookingId: "f6000000-0000-4000-8000-000000000001",
      url: "https://meet.google.com/abc-defg-hij",
    },
  ]);
});
