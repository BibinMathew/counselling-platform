"use client";
import { useActionState } from "react";
import { runReconciliation, updatePrice } from "../actions";
export function AdminPaymentControls({ amount }: { amount: number }) {
  const [price, priceAction, saving] = useActionState(updatePrice, { message: "" });
  const [reconciliation, reconcileAction, pending] = useActionState(runReconciliation, {
    message: "",
  });
  return (
    <>
      <form action={priceAction} className="availability-form">
        <label>
          Session price (INR)
          <input
            name="price"
            inputMode="decimal"
            defaultValue={(amount / 100).toFixed(2)}
            required
          />
        </label>
        <button disabled={saving}>Save session price</button>
        {price.message && <p role="status">{price.message}</p>}
      </form>
      <form action={reconcileAction}>
        <button disabled={pending}>
          {pending ? "Checking payments..." : "Reconcile payments"}
        </button>
        {reconciliation.message && <p role="status">{reconciliation.message}</p>}
      </form>
    </>
  );
}
