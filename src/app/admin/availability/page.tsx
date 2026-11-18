import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/modules/availability/components/availability-editor";
import { requireProfileRole } from "@/modules/identity/server/access";

export default function AdminAvailabilitySettingsPage() {
  return (
    <main className="catalog-page">
      <Link href="/admin">Admin area</Link>
      <h1>Scheduling settings</h1>
      <Suspense fallback={<p>Loading settings...</p>}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}

async function SettingsContent() {
  await connection();
  await requireProfileRole("admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("availability_settings").select("*").single();
  if (error || !data) throw new Error("Scheduling settings could not be loaded.");
  return <SettingsForm settings={data} />;
}
