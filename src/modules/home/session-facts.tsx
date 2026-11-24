import { getPaymentPrice } from "@/modules/payments/server";
import { getPublicSessionSettings } from "@/modules/availability/server/availability";
import { formatPrice } from "@/modules/payments/model";
import { connection } from "next/server";
import { cache } from "react";

const getSessionFacts = cache(async () => {
  await connection();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return null;
  let facts = "See current prices and times in the directory.";
  try {
    const [price, settings] = await Promise.all([getPaymentPrice(), getPublicSessionSettings()]);
    facts = `${settings.session_minutes}-minute sessions · ${formatPrice(price.amount_paise)}`;
  } catch {
    /* Omit unavailable settings; never invent a price. */
  }
  return facts;
});

export async function SessionFacts() {
  const facts = await getSessionFacts();
  if (!facts) return null;
  return <span className="session-facts">{facts}</span>;
}
