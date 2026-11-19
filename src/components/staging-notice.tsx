import { connection } from "next/server";
import { readDeployment } from "@/lib/deployment";
export async function StagingNotice() {
  await connection();
  if (readDeployment(process.env).kind !== "staging") return null;
  return (
    <aside className="staging-notice" aria-label="Staging environment">
      Private staging · Fictional content only. Payments are simulated; no money is collected. No
      SMS, email or WhatsApp is sent. Notification batches run manually.
    </aside>
  );
}
