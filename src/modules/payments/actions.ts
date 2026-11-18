"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfileRole } from "@/modules/identity/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reconcilePayments } from "./server";
export type PaymentActionState = { message: string };
export async function updatePrice(
  _state: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  await requireProfileRole("admin");
  const value = z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .safeParse(form.get("price"));
  if (!value.success)
    return { message: "Enter a price in rupees with at most two decimal places." };
  const amount = Math.round(Number(value.data) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 10000000)
    return { message: "Price must be between ₹1 and ₹100,000." };
  const db = (await createSupabaseServerClient()) as unknown as SupabaseClient;
  const { error } = await db.rpc("set_payment_price", { p_amount_paise: amount });
  if (error) return { message: "Price could not be saved." };
  revalidatePath("/counselors", "layout");
  revalidatePath("/admin/payments");
  revalidatePath("/bookings");
  return { message: "Price saved. Existing checkout orders retain their original total." };
}
export async function runReconciliation(): Promise<PaymentActionState> {
  await requireProfileRole("admin");
  try {
    const result = await reconcilePayments();
    revalidatePath("/admin/payments");
    revalidatePath("/bookings");
    return {
      message: `Checked ${result.checked} payment orders; ${result.failed} need another attempt or admin review.`,
    };
  } catch {
    return { message: "Reconciliation is unavailable. Check server payment configuration." };
  }
}
