import { expect, it } from "vitest";
import { RazorpayProvider } from "@/modules/payments/provider";

const config = {
  mode: "razorpay" as const,
  keyId: "rzp_test_example",
  keySecret: "secret",
  webhookSecret: "webhook",
};
it("creates the exact server-priced order with its durable receipt", async () => {
  const provider = new RazorpayProvider(config, async (input, init) => {
    expect(String(input)).toBe("https://api.razorpay.com/v1/orders");
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: 69900,
      currency: "INR",
      receipt: "stable-receipt",
      partial_payment: false,
    });
    return Response.json({
      id: "order_1",
      amount: 69900,
      currency: "INR",
      receipt: "stable-receipt",
      status: "created",
    });
  });
  expect((await provider.createOrder("stable-receipt", 69900, "INR")).id).toBe("order_1");
});
it("does not automatically repeat an ambiguous order creation", async () => {
  let requests = 0;
  const provider = new RazorpayProvider(config, async () => {
    requests++;
    throw new Error("connection reset");
  });
  await expect(provider.createOrder("receipt", 69900, "INR")).rejects.toThrow();
  expect(requests).toBe(1);
});
it("recovers by receipt and rejects malformed provider responses", async () => {
  const provider = new RazorpayProvider(config, async (input) => {
    expect(String(input)).toContain("receipt=internal-id");
    return Response.json({
      items: [
        {
          id: "order_2",
          amount: 69900,
          currency: "INR",
          receipt: "internal-id",
          status: "created",
        },
      ],
    });
  });
  expect((await provider.findOrders("internal-id"))[0].id).toBe("order_2");
  const bad = new RazorpayProvider(config, async () => Response.json({ id: "missing-amount" }));
  await expect(bad.getOrder("bad")).rejects.toThrow();
});
