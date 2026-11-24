import { CounselorPortrait } from "@/modules/catalog/components/counselor-portrait";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import {
  getPublicAvailability,
  getPublicSessionSettings,
} from "@/modules/availability/server/availability";
import { getPublicCounselor } from "@/modules/catalog/server/catalog";
import { getPaymentPrice } from "@/modules/payments/server";
import { formatPrice } from "@/modules/payments/model";
import { isCatalogDemoMode } from "@/modules/catalog/demo";
import { getCounselorCategoryLabel } from "@/modules/catalog/categories";

export default function CounselorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  return (
    <div className="page-main catalog-page">
      <Link href="/counselors">All counselors</Link>
      <Suspense fallback={<p>Loading profile...</p>}>
        <CounselorContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CounselorContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  await connection();
  const { id } = await params;
  const reschedule = z
    .string()
    .uuid()
    .safeParse((await searchParams).reschedule);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const counselor = await getPublicCounselor(id);
  if (!counselor) notFound();
  if (isCatalogDemoMode()) {
    return (
      <>
        <p className="catalog-demo-notice" role="note">
          Fictional UX sample only. This is not a real therapist and bookings are unavailable.
        </p>
        <article className="counselor-detail">
          <CounselorPortrait src={counselor.photo_url} name={counselor.display_name} />
          <div>
            <p className="counselor-card-category">
              {getCounselorCategoryLabel(counselor.category)}
            </p>
            <h1>{counselor.display_name}</h1>
            <p>{counselor.qualifications}</p>
            <p>{counselor.experience}</p>
          </div>
          <div className="counselor-about">
            <h2>About</h2>
            <p>{counselor.bio}</p>
            <h2>Areas of practice</h2>
            <p>{counselor.specialties}</p>
            <h2>Languages</h2>
            <p>{counselor.languages}</p>
          </div>
        </article>
      </>
    );
  }
  const [slots, settings, price] = await Promise.all([
    getPublicAvailability(id),
    getPublicSessionSettings(),
    getPaymentPrice(),
  ]);
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
  const groupedSlots = new Map<string, typeof slots>();
  for (const slot of slots) {
    const date = dateFormatter.format(new Date(slot.start_at));
    groupedSlots.set(date, [...(groupedSlots.get(date) ?? []), slot]);
  }
  return (
    <article className="counselor-detail">
      <CounselorPortrait src={counselor.photo_url} name={counselor.display_name} />
      <div>
        <p className="counselor-card-category">{getCounselorCategoryLabel(counselor.category)}</p>
        <h1>{counselor.display_name}</h1>
        <p>{counselor.qualifications}</p>
        <p>{counselor.experience}</p>
        <p>
          {settings.session_minutes}-minute session · {formatPrice(price.amount_paise)}
        </p>
      </div>
      <div className="counselor-about">
        <h2>About</h2>
        <p>{counselor.bio}</p>
        <h2>Specializations</h2>
        <p>{counselor.specialties}</p>
        <h2>Languages</h2>
        <p>{counselor.languages}</p>
        <h2 id="available-times">Available times</h2>
        <p>Asia/Kolkata</p>
        {slots.length === 0 && <p>No available times in the current booking window.</p>}
        {[...groupedSlots].map(([date, daySlots]) => (
          <section key={date} className="available-day">
            <h3>{date}</h3>
            <ul>
              {daySlots.map((slot) => (
                <li key={slot.start_at}>
                  <Link
                    href={`/book?${new URLSearchParams({ counselor: id, start: slot.start_at, ...(reschedule.success ? { reschedule: reschedule.data } : {}) })}`}
                  >
                    <time dateTime={slot.start_at}>
                      {timeFormatter.format(new Date(slot.start_at))}
                    </time>
                    –
                    <time dateTime={slot.end_at}>
                      {timeFormatter.format(new Date(slot.end_at))}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
