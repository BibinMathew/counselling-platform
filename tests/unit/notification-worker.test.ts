import { expect, test } from "vitest";
import { dispatchBatch } from "@/modules/notifications/provider";
test("a failed job cannot abort another delivery", async () => {
  const result = await dispatchBatch(
    [
      { id: "bad", leaseToken: "a" },
      { id: "good", leaseToken: "b" },
    ],
    {
      async dispatch(job) {
        if (job.id === "bad") throw new Error("lost database");
        return "delivered";
      },
    },
  );
  expect(result).toEqual({ checked: 2, delivered: 1, failed: 1 });
});
test("retries and stale leases are not reported as delivered", async () => {
  const states = ["retrying", "failed", "stale", "superseded", "skipped"];
  expect(
    await dispatchBatch(
      states.map((id) => ({ id, leaseToken: "x" })),
      {
        async dispatch(job) {
          return job.id;
        },
      },
    ),
  ).toEqual({ checked: 5, delivered: 0, failed: 2 });
});
