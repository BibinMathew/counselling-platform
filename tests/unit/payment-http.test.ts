import { expect, it } from "vitest";
import { hasSameOrigin, readLimitedBody } from "@/modules/payments/http";
it("validates browser origin against the public Host rather than Next's internal URL", () => {
  expect(
    hasSameOrigin(
      new Request("http://localhost:3110/api/payments/checkout", {
        headers: { host: "127.0.0.1:3110", origin: "http://127.0.0.1:3110" },
      }),
    ),
  ).toBe(true);
  for (const origin of [
    "https://evil.test",
    "null",
    "http://127.0.0.1:9999",
    "https://127.0.0.1:3110",
  ])
    expect(
      hasSameOrigin(
        new Request("http://localhost:3110/api/payments/checkout", {
          headers: { host: "127.0.0.1:3110", origin },
        }),
      ),
    ).toBe(false);
  expect(hasSameOrigin(new Request("http://localhost/api/payments/checkout"))).toBe(false);
});
it("limits streamed request bodies even without content-length", async () => {
  const request = new Request("http://localhost", { method: "POST", body: "123456" });
  await expect(readLimitedBody(request, 5)).rejects.toThrow("Request too large");
  await expect(
    readLimitedBody(new Request("http://localhost", { method: "POST", body: "12345" }), 5),
  ).resolves.toBe("12345");
});
